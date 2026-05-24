import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  ImageBackground,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WebView } from "react-native-webview";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { requestProfileApi } from "../Profile/profileApi.js";
import * as DocumentPicker from 'expo-document-picker';
import {
  saveModuleProgress,
  fetchModuleProgress,
  calculateProgressPercent,
} from "./moduleProgressApi.js";
import withRoleGuard from "../auth/withRoleGuard";

// Removed sample `MODULE_SECTIONS` constant; sections are loaded from API or left empty.

function readSectionDescription(source) {
  if (!source) {
    return "";
  }

  return String(
    source.description ||
      source.Description ||
      source.sectionDescription ||
      source.section_description ||
      source.summary ||
      "",
  ).trim();
}

function sanitizeRichHtml(value) {
  return String(value || "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+="[^"]*"/gi, "")
    .replace(/\son[a-z]+='[^']*'/gi, "");
}

function normalizeModuleCompletionStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === 'completed' || normalized === 'complete') {
    return 'completed';
  }

  return 'incomplete';
}

function parseModulePrice(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const normalized = String(value).replace(/,/g, '').trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatModulePrice(value) {
  const parsed = parseModulePrice(value);

  if (parsed === null) {
    return null;
  }

  return parsed.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function resolveModulePrice(...sources) {
  for (const source of sources) {
    if (!source) {
      continue;
    }

    const nested = source.data && source.data !== source ? source.data : null;

    const candidate =
      source.modulePrice ??
      source.price ??
      source.fee ??
      source.module_fee ??
      source.amount ??
      source.paymentAmount ??
      source.totalAmount ??
      source.total ??
      nested?.modulePrice ??
      nested?.price ??
      nested?.fee ??
      nested?.module_fee ??
      nested?.amount ??
      nested?.paymentAmount ??
      nested?.totalAmount ??
      nested?.total ??
      null;

    if (candidate !== null && candidate !== undefined && candidate !== '') {
      return candidate;
    }
  }

  return null;
}

function buildRichContentDocument(title, contentHtml) {
  const normalizedTitle = String(title || "Section").trim();
  const safeHtml = sanitizeRichHtml(contentHtml).trim();
  const bodyContent =
    safeHtml || "<p>No content available for this section.</p>";

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        color: #2f4a3d;
        line-height: 1.6;
        font-size: 15px;
        background: #ffffff;
      }
      h1, h2, h3, h4, h5, h6 {
        color: #1f3a2a;
        margin: 0 0 10px;
      }
      p, ul, ol, blockquote, pre {
        margin: 0 0 12px;
      }
      img {
        border-radius: 8px;
      }
      iframe, video, embed {
        border-radius: 8px;
        min-height: 360px;
      }
      .video-container {
        position: relative;
        width: 100%;
        padding-bottom: 56.25%;
        height: 0;
        overflow: hidden;
      }
      .video-container iframe {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        min-height: unset;
        border-radius: 8px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      table, th, td {
        border: 1px solid #e3eadf;
      }
      th, td {
        padding: 8px;
      }
    </style>
    <title>${normalizedTitle}</title>
  </head>
  <body>
    ${bodyContent}
  </body>
</html>`;
}

function ModuleScreen({
  route,
  navigation,
  currentProfile,
  useSharedChrome = false,
}) {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const role = currentProfile?.viewerRole || currentProfile?.role || "User";
  const isAdmin = role === "Admin";
  const routeModuleId = route?.params?.moduleId || null;
  const routeModuleName =
    route?.params?.moduleName || route?.params?.grade || "General";
  const routeCompletionStatus = route?.params?.completionStatus || null;
  const userLabel =
    currentProfile?.fullName || currentProfile?.username || "Guide";

  const [moduleDisplayName, setModuleDisplayName] = useState(routeModuleName);
  const [moduleSummary, setModuleSummary] = useState(route?.params?.moduleSummary || '');
  const [modulePrice, setModulePrice] = useState(
    resolveModulePrice(route?.params) ?? null,
  );
  const [moduleCompletionStatus, setModuleCompletionStatus] = useState(
    normalizeModuleCompletionStatus(routeCompletionStatus),
  );
  const progressionUnlocked =
    isAdmin || route?.params?.progressionUnlocked !== false;
  const progressionLockReason =
    route?.params?.progressionLockReason ||
    "Complete the required previous assessment to unlock this one.";

  const [sections, setSections] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [visitedSectionIds, setVisitedSectionIds] = useState(new Set());
  const [expandedSectionIds, setExpandedSectionIds] = useState(new Set());
  const [loading, setLoading] = useState(Boolean(routeModuleId));
  const [isOnSite, setIsOnSite] = useState(false);

  const [paymentStatus, setPaymentStatus] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(true);
  const [submissionDetails, setSubmissionDetails] = useState(null);

  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [submissionDetailModalVisible, setSubmissionDetailModalVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingSuccessAlert, setPendingSuccessAlert] = useState(null);
  const fileInputRef = useRef(null); 

  const BANK_DETAILS = {
    bankName: "Maybank Islamic Berhad",
    accountName: "Sarawak Parks Training Academy",
    accountNumber: "1234 5678 9012 3456",
    referenceFormat: `MOD-${routeModuleId || "XXXX"}-${currentProfile?.username || "USER"}`,
  };

  const isPaid = paymentStatus === "paid";
  const isPaymentPending = paymentStatus === "pending";
  const isAccessCheckComplete = !loading && !paymentLoading;
  const isOnSiteProgressionLocked = isOnSite && !progressionUnlocked;

  const formatDateTime = (value) => {
    if (!value) {
      return "-";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleString();
  };

  const openSubmissionDetails = () => {
    if (!submissionDetails) {
      Alert.alert("No Submission Found", "We could not find your latest payment submission details.");
      return;
    }
    setSubmissionDetailModalVisible(true);
  };

  useEffect(() => {
    if (paymentModalVisible || !pendingSuccessAlert) {
      return;
    }

    const interactionHandle = InteractionManager.runAfterInteractions(() => {
      Alert.alert(pendingSuccessAlert.title, pendingSuccessAlert.message);
      setPendingSuccessAlert(null);
    });

    return () => {
      interactionHandle?.cancel?.();
    };
  }, [paymentModalVisible, pendingSuccessAlert]);

  const fetchPaymentStatus = async () => {
    if (!routeModuleId || isAdmin) {
      setPaymentStatus("paid");
      setSubmissionDetails(null);
      setPaymentLoading(false);
      return "paid";
    }

    try {
      const token = await AsyncStorage.getItem("auth_token");
      const response = await requestProfileApi(
        `/api/v1/modules/${routeModuleId}/payment-status`,
        token,
        { method: "GET" },
      );

      const status = response?.data?.status || "unpaid";
      setPaymentStatus(status);
      setSubmissionDetails(response?.data?.submission || null);
      return status;
    } catch (error) {
      console.warn("Failed to fetch payment status:", error);
      setPaymentStatus("unpaid");
      setSubmissionDetails(null);
      return "unpaid";
    } finally {
      setPaymentLoading(false);
    }
  };

  const pickPaymentEvidence = async () => {
    if (isWeb) {
      fileInputRef.current?.click();
      return;
    }

    // Mobile: allow images and PDFs
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        const file = result.assets[0];
        const mime = file.mimeType || file.type || '';
        if (mime.startsWith('image/') || mime === 'application/pdf') {
          setSelectedFile({
            name: file.name,
            uri: file.uri,
            type: mime || (mime.startsWith('image/') ? 'image/*' : 'application/pdf'),
          });
        } else {
          Alert.alert('Invalid File', 'Please select a PDF or image file.');
        }
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to pick a file');
    }
  };

  const handleWebFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const mime = file.type || '';
    if (mime === 'application/pdf' || mime.startsWith('image/')) {
      setSelectedFile({
        name: file.name,
        uri: URL.createObjectURL(file),
        type: file.type,
        fileObject: file,
      });
    } else {
      Alert.alert('Invalid File', 'Please select a PDF or image file.');
    }
  };

  const submitPaymentEvidence = async () => {
    if (!selectedFile) {
      Alert.alert('Missing File', 'Please select a PDF or image file first');
      return;
    }

    setIsSubmitting(true);

    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        Alert.alert('Error', 'No authentication token found');
        return;
      }

      const formData = new FormData();
      formData.append('moduleId', routeModuleId);
      formData.append('reference', BANK_DETAILS.referenceFormat);

      // === WEB vs MOBILE handling ===
      if (isWeb && selectedFile.fileObject) {
        formData.append('evidence', selectedFile.fileObject, selectedFile.fileObject.name);
      } else if (selectedFile.uri) {
        formData.append('evidence', {
          uri: selectedFile.uri,
          name: selectedFile.name,
          type: selectedFile.type || 'application/pdf',
        });
      }

      console.log('🚀 Submitting payment on', isWeb ? 'WEB' : 'MOBILE'); // Debug log

      const response = await requestProfileApi('/api/v1/enrollment/submit-payment', token, {
        method: 'POST',
        body: formData,
        headers: {
          // Do NOT set Content-Type manually for FormData
        },
      });

      console.log('✅ API Response:', response);

      // If requestProfileApi doesn't throw, the response was successful (2xx status)
      setPaymentModalVisible(false);
      setSelectedFile(null);
      setPaymentStatus('pending');
      fetchPaymentStatus();
      setPendingSuccessAlert({
        title: '✅ Success',
        message: 'Payment evidence submitted successfully!',
      });
    } catch (err) {
      console.error('❌ Submit Error:', err);
      Alert.alert(
        'Submission Failed', 
        'Please check your connection and try again.\n\n' + 
        (err.message ? err.message : 'Unknown error')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedSection = useMemo(() => {
    const selectedTopLevelSection = sections.find(
      (section) => section.id === selectedSectionId,
    );

    if (selectedTopLevelSection) {
      return selectedTopLevelSection;
    }

    for (const section of sections) {
      const selectedSubsection = (section.subsections || []).find(
        (subsection) => subsection.id === selectedSectionId,
      );

      if (selectedSubsection) {
        return selectedSubsection;
      }
    }

    return null;
  }, [sections, selectedSectionId]);

  useEffect(() => {
      if (!routeModuleId) {
        setPaymentStatus("paid");
        setPaymentLoading(false);
        // No sample sections: leave sections empty so UI shows "no content" state.
        setSections([]);
        setSelectedSectionId(null);
        setVisitedSectionIds(new Set());
        setExpandedSectionIds(new Set());
        setModuleDisplayName(routeModuleName);
        setLoading(false);
        return;
      }

    let active = true;

    const loadModuleContent = async () => {
      setLoading(true);
      setVisitedSectionIds(new Set());

      try {
        const token = await AsyncStorage.getItem("auth_token");

        if (!token) {
          throw new Error("No active session.");
        }

        const response = await requestProfileApi(
          `/api/v1/modules/${routeModuleId}/details`,
          token,
          {
            method: "GET",
          },
        );

        const resolvedTitle = String(
          response?.data?.title ||
            response?.data?.moduleTitle ||
            response?.data?.moduleName ||
            response?.data?.name ||
            routeModuleName,
        ).trim();

        const materials = Array.isArray(response?.data?.materials)
          ? response.data.materials
          : [];

        const apiSections = Array.isArray(response?.data?.sections)
          ? response.data.sections
          : null;

        const moduleTypeCandidate =
          response?.data?.moduleType ||
          response?.data?.module_type ||
          response?.data?.type ||
          response?.data?.moduleTypeId ||
          response?.data?.module_type_id ||
          route?.params?.moduleType ||
          route?.params?.moduleStage ||
          route?.params?.stage ||
          route?.params?.moduleTypeId ||
          null;

        const isOnSiteValue = (candidate) => {
          if (candidate === null || candidate === undefined || candidate === "")
            return false;
          const asNum = Number(candidate);
          const asStr = String(candidate).trim().toLowerCase();
          if (!Number.isNaN(asNum) && asNum === 3) return true;
          if (
            asStr === "3" ||
            asStr === "on-site" ||
            asStr === "onsite" ||
            asStr === "on site" ||
            asStr.includes("on-site") ||
            asStr.includes("onsite") ||
            asStr.includes("on site")
          )
            return true;
          return false;
        };

        if (isOnSiteValue(moduleTypeCandidate)) {
          setIsOnSite(true);
        } else {
          setIsOnSite(false);
        }

        if (active && resolvedTitle) {
          setModuleDisplayName(resolvedTitle);
        }

        // Module summary (short description) provided by API when available
        const resolvedSummary =
          String(response?.data?.summary || response?.data?.Summary || '') || '';
        if (active) {
          setModuleSummary(resolvedSummary);
        }

        const resolvedPrice = resolveModulePrice(response, response?.data, route?.params);
        if (active) {
          setModulePrice((previous) => resolvedPrice ?? previous);
        }

        const resolvedCompletionStatus =
          response?.data?.completionStatus ||
          response?.data?.onSiteCompletionStatus ||
          response?.data?.onSiteStatus ||
          routeCompletionStatus;
        if (active) {
          setModuleCompletionStatus(normalizeModuleCompletionStatus(resolvedCompletionStatus));
        }

        if (!materials.length && !apiSections?.length) {
          if (active) {
            setSections([]);
            setSelectedSectionId(null);
            setVisitedSectionIds(new Set());
            setExpandedSectionIds(new Set());
          }
          return;
        }

        const groupedSections = [];
        const sectionIndexByTitle = new Map();
        if (apiSections) {
          apiSections.forEach((s, idx) => {
            const secId = s.id || s.sectionId || `section-${idx + 1}`;
            const title = String(
              s.title || s.name || `Section ${idx + 1}`,
            ).trim();
            const description = readSectionDescription(s);
            const subsections = Array.isArray(s.subsections)
              ? s.subsections.map((sub, si) => ({
                  id:
                    sub.id ||
                    sub.subsectionId ||
                    `subsection-${idx + 1}-${si + 1}`,
                  title: String(sub.title || `Part ${si + 1}`).trim(),
                  contentHtml: String(
                    sub.content || sub.contentHtml || "",
                  ).trim(),
                  parentId: secId,
                }))
              : [];

            groupedSections.push({
              id: secId,
              title,
              description,
              contentHtml: "",
              subsections,
            });
          });
        } else {
          materials.forEach((material, index) => {
            const sectionTitle = String(
              material.sectionTitle || material.chapter || "",
            ).trim();
            const itemTitle = String(
              material.title || material.subTitle || "",
            ).trim();
            const contentHtml = String(
              material.content || material.contentHtml || "",
            ).trim();
            const description = readSectionDescription(material);
            const materialId = String(
              material.materialId || `material-${index + 1}`,
            );

            if (!sectionTitle) {
              const fallbackSectionTitle =
                itemTitle || `Section ${groupedSections.length + 1}`;
              groupedSections.push({
                id: `section-${materialId}`,
                title: fallbackSectionTitle,
                contentHtml,
                description,
                subsections: [],
              });
              return;
            }

            const sectionKey = sectionTitle.toLowerCase();
            let sectionIndex = sectionIndexByTitle.get(sectionKey);

            if (sectionIndex === undefined) {
              sectionIndex = groupedSections.length;
              sectionIndexByTitle.set(sectionKey, sectionIndex);
              groupedSections.push({
                id: `section-${materialId}`,
                title: sectionTitle,
                contentHtml: "",
                description: "",
                subsections: [],
              });
            }

            const section = groupedSections[sectionIndex];
            if (!section.description && description) {
              section.description = description;
            }
            const isSubsection =
              itemTitle &&
              itemTitle.toLowerCase() !== sectionTitle.toLowerCase();

            if (isSubsection) {
              section.subsections.push({
                id: `subsection-${materialId}`,
                title: itemTitle,
                contentHtml,
                parentId: section.id,
              });
              return;
            }

            if (!section.contentHtml) {
              section.contentHtml = contentHtml;
            }
          });
        }

        const formattedSections = groupedSections;

        if (active) {
          setSections(formattedSections);
          setSelectedSectionId(formattedSections[0]?.id || null);
          setExpandedSectionIds(new Set());
          setVisitedSectionIds(
            formattedSections[0]?.id
              ? new Set([formattedSections[0].id])
              : new Set(),
          );
          setLoading(false);

          try {
            const savedProgress = await fetchModuleProgress(routeModuleId, token);

            if (
              active &&
              savedProgress.visitedSectionIds &&
              savedProgress.visitedSectionIds.length > 0
            ) {
              setVisitedSectionIds(new Set(savedProgress.visitedSectionIds));
              if (savedProgress.visitedSectionIds.length > 0) {
                setSelectedSectionId(savedProgress.visitedSectionIds[0]);
              }
              console.log(
                `Restored progress for module ${routeModuleId}: ${savedProgress.visitedSectionIds.length} sections visited`,
              );
            } else {
              setVisitedSectionIds(
                formattedSections[0]?.id
                  ? new Set([formattedSections[0].id])
                  : new Set(),
              );
            }
          } catch (progressError) {
            console.warn(
              "Could not restore progress, starting fresh:",
              progressError,
            );
          }
        }
      } catch (_error) {
        console.log("Fetch Error Details:", _error);

        if (active) {
          setSections([]);
          setSelectedSectionId(null);
          setExpandedSectionIds(new Set());
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    const start = async () => {
      // Determine if module is an on-site type from route params (if provided)
      const paramCandidate =
        route?.params?.moduleType ||
        route?.params?.moduleStage ||
        route?.params?.stage ||
        route?.params?.module_type ||
        route?.params?.type ||
        route?.params?.moduleTypeId ||
        route?.params?.module_type_id ||
        null;

      const isOnSiteValueFromParam = (candidate) => {
        if (candidate === null || candidate === undefined || candidate === "")
          return false;
        const asNum = Number(candidate);
        const asStr = String(candidate).trim().toLowerCase();
        if (!Number.isNaN(asNum) && asNum === 3) return true;
        if (
          asStr === "3" ||
          asStr === "on-site" ||
          asStr === "onsite" ||
          asStr === "on site" ||
          asStr.includes("on-site") ||
          asStr.includes("onsite") ||
          asStr.includes("on site")
        )
          return true;
        return false;
      };

      try {
        const status = await fetchPaymentStatus();

        // If payment not done, and user isn't admin, and module isn't clearly on-site from params,
        // skip fetching module details and show the payment UI instead.
        const onSiteFromParams = isOnSiteValueFromParam(paramCandidate);
        if (!isAdmin && !onSiteFromParams && status !== "paid") {
          setLoading(false);
          return;
        }

        // Payment OK or admin or on-site inferred -> proceed to load content
        await loadModuleContent();
      } catch (err) {
        // If fetchPaymentStatus or other steps fail, fall back to attempting content load
        await loadModuleContent();
      }
    };

    start();

    return () => {
      active = false;
    };
  }, [routeModuleId]);

  const canAccessContent = isAdmin || isPaid || (isOnSite && progressionUnlocked);

  useEffect(() => {
    if (!sections.length) {
      setSelectedSectionId(null);
      setExpandedSectionIds(new Set());
      return;
    }

    setSelectedSectionId((previousSelectedSectionId) => {
      const hasExisting = sections.some(
        (section) => section.id === previousSelectedSectionId,
      );
      return hasExisting ? previousSelectedSectionId : sections[0].id;
    });
  }, [sections]);

  useEffect(() => {
    if (
      !routeModuleId ||
      sections.length === 0 ||
      visitedSectionIds.size === 0
    ) {
      return;
    }

    let saveTimeout;
    const autoSaveProgress = async () => {
      try {
        const token = await AsyncStorage.getItem("auth_token");
        if (!token) return;

        const progressPercent = calculateProgressPercent(
          visitedSectionIds,
          sections,
        );
        await saveModuleProgress(
          routeModuleId,
          Array.from(visitedSectionIds),
          progressPercent,
          token,
        );
        console.log(
          `Auto-saved progress for module ${routeModuleId}: ${progressPercent}%`,
        );
      } catch (error) {
        console.warn("Auto-save failed:", error);
      }
    };

    // Debounce auto-save by 2 seconds to avoid too many requests
    saveTimeout = setTimeout(autoSaveProgress, 2000);

    return () => clearTimeout(saveTimeout);
  }, [visitedSectionIds, routeModuleId, sections]);

  useEffect(() => {
    return () => {
      if (routeModuleId && sections.length > 0 && visitedSectionIds.size > 0) {
        (async () => {
          try {
            const token = await AsyncStorage.getItem("auth_token");
            if (!token) return;

            const progressPercent = calculateProgressPercent(
              visitedSectionIds,
              sections,
            );
            await saveModuleProgress(
              routeModuleId,
              Array.from(visitedSectionIds),
              progressPercent,
              token,
            );
            console.log(
              `Saved progress on unmount for module ${routeModuleId}: ${progressPercent}%`,
            );
          } catch (error) {
            console.warn("Could not save progress on unmount:", error);
          }
        })();
      }
    };
  }, [routeModuleId, sections, visitedSectionIds]);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate("Home");
  };

  const selectSection = (sectionId) => {
    if (!canAccessContent) return;
    setSelectedSectionId(sectionId);
    setVisitedSectionIds((previousVisitedSectionIds) => {
      const nextVisitedSectionIds = new Set(previousVisitedSectionIds);
      nextVisitedSectionIds.add(sectionId);
      return nextVisitedSectionIds;
    });
  };

  const toggleSectionExpansion = (sectionId) => {
    setExpandedSectionIds((previousExpandedSectionIds) => {
      const nextExpandedSectionIds = new Set(previousExpandedSectionIds);

      if (nextExpandedSectionIds.has(sectionId)) {
        nextExpandedSectionIds.delete(sectionId);
      } else {
        nextExpandedSectionIds.add(sectionId);
      }

      return nextExpandedSectionIds;
    });

    selectSection(sectionId);
  };

  const selectSubsection = (sectionId, subsectionId) => {
    if (!canAccessContent) return;
    setExpandedSectionIds((previousExpandedSectionIds) => {
      const nextExpandedSectionIds = new Set(previousExpandedSectionIds);
      nextExpandedSectionIds.add(sectionId);
      return nextExpandedSectionIds;
    });

    setSelectedSectionId(subsectionId);
    setVisitedSectionIds((previousVisitedSectionIds) => {
      const nextVisitedSectionIds = new Set(previousVisitedSectionIds);
      nextVisitedSectionIds.add(sectionId);
      nextVisitedSectionIds.add(subsectionId);
      return nextVisitedSectionIds;
    });
  };

  const assessmentUnlocked =
    !isOnSite &&
    sections.length > 0 &&
    sections.every((section) => {
      const subsectionIds = (section.subsections || []).map(
        (subsection) => subsection.id,
      );

      return (
        visitedSectionIds.has(section.id) &&
        subsectionIds.every((subsectionId) =>
          visitedSectionIds.has(subsectionId),
        )
      );
    });

  // Admins should always be able to navigate to the Assessment page to edit questions.
  const canTakeAssessment =
    isAdmin || (isPaid && assessmentUnlocked && progressionUnlocked);

  const renderSectionBody = (section, variant = "desktop") => {
    if (!section) {
      return (
        <Text style={styles.contentText}>No section content available.</Text>
      );
    }

    const isSubsection = Boolean(section.parentId);

    if (isSubsection) {
      const richDocumentHtml = buildRichContentDocument(
        section.title,
        section.contentHtml || section.content || "",
      );

      if (isWeb) {
        const iframeHeight = variant === "mobile" ? 300 : 560;

        return React.createElement("iframe", {
          title: `section-content-${section.id}`,
          srcDoc: richDocumentHtml,
          style: {
            width: "100%",
            height: `${iframeHeight}px`,
            border: "0",
            borderRadius: "10px",
            backgroundColor: "#ffffff",
          },
          allow:
            "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen",
          allowFullScreen: true,
          loading: "lazy",
        });
      }

      const webViewHeight = variant === "mobile" ? 300 : 560;

      return (
        <WebView
          originWhitelist={["*"]}
          source={{ html: richDocumentHtml }}
          style={[styles.contentWebView, { height: webViewHeight }]}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled
          nestedScrollEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowsFullscreenVideo
          mixedContentMode="always"
          setSupportMultipleWindows={false}
          automaticallyAdjustContentInsets={false}
        />
      );
    }

    // Top-level section: show the admin-entered description in the body.
    const plainDescription = readSectionDescription(section);

    if (plainDescription) {
      if (isWeb) {
        return React.createElement(
          "div",
          {
            style: {
              width: "100%",
              padding: 12,
              backgroundColor: "#ffffff",
              color: "#3E5648",
              fontSize: 15,
              lineHeight: "23px",
              borderRadius: 8,
              border: "1px solid #EEF2EA",
              whiteSpace: "pre-wrap",
            },
          },
          plainDescription,
        );
      }

      return <Text style={styles.contentText}>{plainDescription}</Text>;
    }

    return (
      <Text style={styles.contentText}>
        No description available for this section.
      </Text>
    );
  };

  const goToAssessment = () => {
    if (isAdmin) {
      navigation.navigate("AdminAssessment", {
        moduleName: moduleDisplayName,
        moduleId: routeModuleId,
      });
      return;
    }

    if (!canTakeAssessment) {
      if (!isPaid) {
        Alert.alert(
          "Payment Required",
          "Please complete payment to unlock the assessment.",
        );
        setPaymentModalVisible(true);
        return;
      }

      if (!progressionUnlocked) {
        Alert.alert("Assessment Locked", progressionLockReason);
        return;
      }

      if (!assessmentUnlocked) {
        Alert.alert(
          "Assessment Locked",
          "Please review every module section before starting the assessment.",
        );
        return;
      }
    }
    navigation.navigate("Assessment", {
      moduleName: moduleDisplayName,
      moduleId: routeModuleId,
      moduleOrder: route?.params?.moduleOrder || null,
      totalModules: route?.params?.totalModules || null,
      moduleProgressPercent: route?.params?.moduleProgressPercent || 0,
      sectionCount: sections.length,
    });
  };

  const goToModuleEditor = () => {
    navigation.navigate("AdminModules", {
      moduleId: routeModuleId,
      moduleName: moduleDisplayName,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      {!useSharedChrome ? (
        <View
          style={[
            styles.topBar,
            {
              paddingTop: isWeb ? 14 : Math.max(10, insets.top + 4),
            },
          ]}
        >
          <TouchableOpacity style={styles.navPill} onPress={handleBack}>
            <Text style={styles.navPillText}>{"< Back"}</Text>
          </TouchableOpacity>

          <Text style={styles.topTitle} numberOfLines={1}>
            {moduleDisplayName}
          </Text>

          <TouchableOpacity
            style={styles.navPill}
            onPress={() => navigation.navigate("Announcements")}
          >
            <Text style={styles.navPillText}>Announcements</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <ImageBackground
          source={{
            uri: "https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=1400&q=80",
          }}
          style={styles.banner}
          imageStyle={styles.bannerImage}
        >
          <View style={styles.bannerOverlay}>
            <Text style={styles.bannerTitle}>{moduleDisplayName}</Text>
            <Text style={styles.bannerSubtitle}>{moduleSummary}</Text>
            <Text style={styles.bannerMeta}>Signed in as: {userLabel}</Text>
          </View>
        </ImageBackground>

        {!isAccessCheckComplete ? (
          <View style={styles.loadingPanel}>
            <ActivityIndicator size="large" color="#2E6B4D" />
            <Text style={styles.loadingText}>Checking access and loading module details...</Text>
          </View>
        ) : isOnSiteProgressionLocked ? (
          <View style={styles.lockedOverlay}>
            <Text style={styles.lockIcon}>🔒</Text>
            <Text style={styles.lockTitle}>On-Site Module Locked</Text>

            <Text style={styles.lockSubtitle}>
              {progressionLockReason || 'Complete and pass the linked assessment to unlock this on-site module.'}
            </Text>
          </View>
        ) : !isAdmin && !isOnSite && paymentStatus && paymentStatus !== "paid" ? (
          <View style={styles.lockedOverlay}>
            <Text style={styles.lockIcon}>🔒</Text>
            <Text style={styles.lockTitle}>
              {paymentStatus === 'pending'
                ? 'Payment Pending'
                : paymentStatus === 'rejected'
                ? 'Payment Rejected'
                : 'Payment Required'}
            </Text>

            <Text style={styles.lockSubtitle}>
              {paymentStatus === 'pending'
                ? 'Your payment is being reviewed. We will notify you once it is confirmed.'
                : paymentStatus === 'rejected'
                ? 'Your payment evidence was rejected. Please resubmit proof of payment.'
                : 'Complete payment to access this module content and assessment.'}
            </Text>

            {paymentStatus === 'pending' ? (
              <TouchableOpacity
                style={styles.paymentButton}
                onPress={openSubmissionDetails}
              >
                <Text style={styles.paymentButtonText}>📄 View Submission</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.paymentButton}
                onPress={() => setPaymentModalVisible(true)}
              >
                <Text style={styles.paymentButtonText}>
                  {paymentStatus === 'rejected' ? 'Resubmit Payment' : '💰 Make Payment Now'}
                </Text>
              </TouchableOpacity>
            )}

            {paymentStatus === 'rejected' ? (
              <Text style={[styles.rejectedText, { marginTop: 12, textAlign: 'center' }]}>If you need help, contact support.</Text>
            ) : null}
          </View>
        ) : (
          <View style={[styles.mainArea, !isWeb && styles.mainAreaMobile]}>
            <View style={[styles.leftNav, !isWeb && styles.leftNavMobile]}>
              {sections.length === 0 ? (
                <View style={styles.emptySectionCard}>
                  <Text style={styles.emptySectionText}>
                    No sections are available for this module yet.
                  </Text>
                </View>
              ) : (
                sections.map((section) => {
                  const isSectionSelected = selectedSection?.id === section.id;
                  const isSubsectionSelected = (section.subsections || []).some(
                    (subsection) => subsection.id === selectedSection?.id,
                  );
                  const isSelected = isSectionSelected || isSubsectionSelected;
                  const isExpanded = expandedSectionIds.has(section.id);

                  return (
                    <View key={section.id}>
                      <TouchableOpacity
                        style={[
                          styles.mainTopic,
                          isSelected && styles.mainTopicActive,
                        ]}
                        onPress={() => toggleSectionExpansion(section.id)}
                      >
                        <Text
                          style={[
                            styles.mainTopicText,
                            isSelected && styles.mainTopicTextActive,
                          ]}
                        >
                          {section.title}
                        </Text>
                      </TouchableOpacity>

                      {isExpanded && (section.subsections || []).length > 0 ? (
                        <View style={styles.subsectionsList}>
                          {section.subsections.map((subsection) => {
                            const subsectionActive =
                              selectedSection?.id === subsection.id;

                            return (
                              <TouchableOpacity
                                key={subsection.id}
                                style={[
                                  styles.subsectionTopic,
                                  subsectionActive &&
                                    styles.subsectionTopicActive,
                                ]}
                                onPress={() =>
                                  selectSubsection(section.id, subsection.id)
                                }
                              >
                                <Text
                                  style={[
                                    styles.subsectionTopicText,
                                    subsectionActive &&
                                      styles.subsectionTopicTextActive,
                                  ]}
                                >
                                  {subsection.title}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ) : null}

                      {!isWeb && isSelected && (
                        <View style={styles.mobileContentCard}>
                          <Text style={styles.contentTitle}>
                            {selectedSection?.title || section.title}
                          </Text>
                          {renderSectionBody(
                            selectedSection || section,
                            "mobile",
                          )}
                        </View>
                      )}
                    </View>
                  );
                })
              )}

              {isAdmin ? (
                <TouchableOpacity
                  style={styles.editModuleButton}
                  onPress={goToModuleEditor}
                >
                  <Text style={styles.editModuleButtonText}>
                    Edit This Module
                  </Text>
                </TouchableOpacity>
              ) : null}

              {!isAdmin && !isOnSite && routeModuleId && !isPaid && (
                <TouchableOpacity
                  style={styles.paymentButton}
                  onPress={() => setPaymentModalVisible(true)}
                >
                  <Text style={styles.paymentButtonText}>
                    💰 Submit Payment for Certification
                  </Text>
                  <Text style={styles.paymentButtonSubtext}>
                    Upload proof of payment to receive your certificate
                  </Text>
                </TouchableOpacity>
              )}

              {!isAdmin && !isOnSite && sections.length > 0 && (
                <View style={styles.progressDisplayCard}>
                  <View style={styles.progressDisplayHeader}>
                    <Text style={styles.progressDisplayLabel}>
                      Your Progress
                    </Text>
                    <Text style={styles.progressDisplayPercent}>
                      {calculateProgressPercent(visitedSectionIds, sections)}%
                    </Text>
                  </View>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${calculateProgressPercent(visitedSectionIds, sections)}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressDisplayHint}>
                    {visitedSectionIds.size} of{" "}
                    {sections.reduce(
                      (acc, s) => acc + 1 + (s.subsections?.length || 0),
                      0,
                    )}{" "}
                    sections visited
                  </Text>
                </View>
              )}

              {!isOnSite ? (
                <TouchableOpacity
                  style={[
                    styles.assessmentButton,
                    !canTakeAssessment && styles.assessmentButtonDisabled,
                  ]}
                  onPress={goToAssessment}
                  disabled={!canTakeAssessment}
                >
                  <Text
                    style={[
                      styles.assessmentButtonText,
                      !canTakeAssessment && styles.assessmentButtonTextDisabled,
                    ]}
                  >
                    {isAdmin
                      ? "Go to Assessment Page to Edit Questions"
                      : !progressionUnlocked
                        ? "Locked by Learning Pathway"
                        : assessmentUnlocked
                          ? "Take Assessment"
                          : "Review Sections First"}
                  </Text>
                  <Text style={styles.assessmentArrow}>{">"}</Text>
                </TouchableOpacity>
              ) : null}
              {isOnSite ? (
                <Text style={styles.assessmentHintText}>
                  This on-site module is {moduleCompletionStatus === 'completed' ? 'Completed' : 'Incomplete'}. Completion is recorded by an admin after training.
                </Text>
              ) : !progressionUnlocked ? (
                <Text style={styles.assessmentHintText}>
                  {progressionLockReason}
                </Text>
              ) : !assessmentUnlocked && sections.length > 0 && !isAdmin ? (
                <Text style={styles.assessmentHintText}>
                  Open each section and every subsection once to unlock the
                  assessment.
                </Text>
              ) : null}
            </View>

            {isWeb && (
              <View style={styles.rightContent}>
                {selectedSection ? (
                  <>
                    <Text style={styles.contentTitle}>
                      {selectedSection.title}
                    </Text>
                    {renderSectionBody(selectedSection, "desktop")}
                  </>
                ) : (
                  <View style={styles.placeholder}>
                    <Text style={styles.placeholderText}>
                      Select a section from the left panel to view content.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <Modal
        animationType="slide"
        transparent={true}
        visible={paymentModalVisible}
        onRequestClose={() => setPaymentModalVisible(false)}
        statusBarTranslucent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.paymentModalCard}>
            <Text style={styles.modalTitle}>Module Certification Payment</Text>

            <View style={styles.bankDetails}>
              <Text style={styles.bankTitle}>Bank Transfer Details</Text>
              <Text style={styles.bankText}>Bank: {BANK_DETAILS.bankName}</Text>
              <Text style={styles.bankText}>
                Account Name: {BANK_DETAILS.accountName}
              </Text>
              <Text style={styles.bankText}>
                Account No:{" "}
                <Text style={styles.accountNumber}>
                  {BANK_DETAILS.accountNumber}
                </Text>
              </Text>
              <Text style={styles.bankText}>
                Reference: {BANK_DETAILS.referenceFormat}
              </Text>
              <Text style={styles.bankText}>
                Fee: {formatModulePrice(modulePrice) ? `RM ${formatModulePrice(modulePrice)}` : 'Not set'}
              </Text>
            </View>

            <Text style={styles.instruction}>
              Transfer the fee and upload your receipt (PDF or image)
            </Text>

            <TouchableOpacity
              style={styles.uploadButton}
              onPress={pickPaymentEvidence}
            >
              <Text style={styles.uploadButtonText}>
                {selectedFile ? "📄 Change Receipt" : "📎 Upload Payment Receipt (PDF or image)"}
              </Text>
            </TouchableOpacity>

            {selectedFile && (
              <Text style={styles.fileName}>Selected: {selectedFile.name}</Text>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setPaymentModalVisible(false);
                  setSelectedFile(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!selectedFile || isSubmitting) && styles.submitDisabled,
                ]}
                onPress={submitPaymentEvidence}
                disabled={!selectedFile || isSubmitting}
              >
                <Text style={styles.submitButtonText}>
                  {isSubmitting ? "Submitting..." : "Submit Evidence"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent={true}
        visible={submissionDetailModalVisible}
        onRequestClose={() => setSubmissionDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.paymentModalCard}>
            <Text style={styles.modalTitle}>Latest Payment Submission</Text>

            <View style={styles.submissionDetailCard}>
              <Text style={styles.submissionDetailRow}>
                <Text style={styles.submissionDetailLabel}>Status: </Text>
                <Text style={styles.submissionDetailValue}>{(paymentStatus || "pending").toUpperCase()}</Text>
              </Text>
              <Text style={styles.submissionDetailRow}>
                <Text style={styles.submissionDetailLabel}>Reference: </Text>
                <Text style={styles.submissionDetailValue}>{submissionDetails?.reference || "-"}</Text>
              </Text>
              <Text style={styles.submissionDetailRow}>
                <Text style={styles.submissionDetailLabel}>Receipt File: </Text>
                <Text style={styles.submissionDetailValue}>{submissionDetails?.evidenceFileName || "-"}</Text>
              </Text>
              <Text style={styles.submissionDetailRow}>
                <Text style={styles.submissionDetailLabel}>Submitted At: </Text>
                <Text style={styles.submissionDetailValue}>{formatDateTime(submissionDetails?.submittedAt)}</Text>
              </Text>
              {submissionDetails?.reviewRemark ? (
                <Text style={styles.submissionDetailRow}>
                  <Text style={styles.submissionDetailLabel}>Admin Remark: </Text>
                  <Text style={styles.submissionDetailValue}>{submissionDetails.reviewRemark}</Text>
                </Text>
              ) : null}
            </View>

            <TouchableOpacity
              style={styles.submitButton}
              onPress={() => setSubmissionDetailModalVisible(false)}
            >
              <Text style={styles.submitButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {isWeb && (
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/*"
          style={{ display: "none" }}
          onChange={handleWebFileSelect}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FBFCF8",
  },
  topBar: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2EA",
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  navPill: {
    backgroundColor: "#ECF2E5",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 92,
    alignItems: "center",
  },
  navPillText: {
    color: "#2E6B4D",
    fontSize: 12,
    fontWeight: "700",
  },
  topTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "800",
    color: "#20372A",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 28,
  },
  banner: {
    height: 220,
    justifyContent: "center",
    margin: 16,
    borderRadius: 18,
    overflow: "hidden",
  },
  bannerImage: {
    borderRadius: 18,
  },
  bannerOverlay: {
    flex: 1,
    backgroundColor: "rgba(24, 47, 37, 0.55)",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  bannerTitle: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "800",
  },
  bannerSubtitle: {
    color: "#E3EDDF",
    fontSize: 13,
    marginTop: 8,
    lineHeight: 20,
  },
  bannerMeta: {
    color: "#D2E2D0",
    fontSize: 12,
    marginTop: 10,
    fontWeight: "600",
  },
  mainArea: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 12,
  },
  mainAreaMobile: {
    flexDirection: "column",
  },
  loadingPanel: {
    marginHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EDF2E8",
    borderRadius: 16,
    paddingVertical: 26,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    color: "#4C6454",
    fontSize: 14,
  },
  leftNav: {
    flex: 1,
    minWidth: 240,
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#EDF2E8",
    shadowColor: "#1D3828",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  leftNavMobile: {
    width: "100%",
    maxWidth: "100%",
  },
  mainTopic: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 6,
    backgroundColor: "#F7F9F4",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mainTopicActive: {
    backgroundColor: "#88A170",
  },
  mainTopicText: {
    color: "#35513F",
    fontWeight: "700",
    fontSize: 15,
    flex: 1,
    paddingRight: 8,
  },
  mainTopicTextActive: {
    color: "#FFFFFF",
  },
  subsectionsList: {
    marginLeft: 16,
    marginBottom: 8,
    borderLeftWidth: 2,
    borderLeftColor: "#D8DDD2",
    paddingLeft: 8,
  },
  subsectionTopic: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 4,
    backgroundColor: "#F4F7F0",
  },
  subsectionTopicActive: {
    backgroundColor: "#DCE8D2",
  },
  subsectionTopicText: {
    color: "#3D5A48",
    fontWeight: "600",
    fontSize: 13,
  },
  subsectionTopicTextActive: {
    color: "#2A4636",
    fontWeight: "700",
  },
  emptySectionCard: {
    backgroundColor: "#F7FAF3",
    borderWidth: 1,
    borderColor: "#E3EBDD",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,
    marginBottom: 10,
  },
  emptySectionText: {
    color: "#5C6F5F",
    fontSize: 14,
    lineHeight: 20,
  },
  mobileContentCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EEE3",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  rightContent: {
    flex: 2,
    minHeight: 520,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#EDF2E8",
    shadowColor: "#1D3828",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  contentTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#274334",
    marginBottom: 14,
  },
  contentText: {
    color: "#3E5648",
    fontSize: 15,
    lineHeight: 23,
  },
  contentWebView: {
    width: "100%",
    backgroundColor: "#FFFFFF",
  },
  placeholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    color: "#70816F",
    fontSize: 15,
    textAlign: "center",
    maxWidth: 320,
  },
  assessmentButton: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: "#EAF2E3",
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  editModuleButton: {
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: "#ECF2E5",
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DDE8D6",
  },
  editModuleButtonText: {
    color: "#2A5A40",
    fontWeight: "800",
    fontSize: 14,
  },
  assessmentButtonDisabled: {
    backgroundColor: "#F1F4EC",
    opacity: 0.85,
  },
  assessmentButtonText: {
    color: "#2A5A40",
    fontWeight: "800",
    fontSize: 14,
  },
  assessmentButtonTextDisabled: {
    color: "#788773",
  },
  assessmentArrow: {
    color: "#2A5A40",
    fontWeight: "800",
    fontSize: 16,
  },
  assessmentHintText: {
    marginTop: 8,
    color: "#6A7A67",
    fontSize: 12,
    fontWeight: "600",
  },
  progressDisplayCard: {
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: "#F5F8F2",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderLeftWidth: 4,
    borderLeftColor: "#2E6B4D",
  },
  progressDisplayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressDisplayLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2A5A40",
  },
  progressDisplayPercent: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2E6B4D",
  },
  progressBar: {
    height: 8,
    backgroundColor: "#DDE8D6",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#2E6B4D",
    borderRadius: 4,
  },
  progressDisplayHint: {
    fontSize: 12,
    color: "#6A7A67",
    fontStyle: "italic",
  },
  paymentButton: {
    marginTop: 12,
    backgroundColor: "#2E6B4D",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  paymentButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  paymentButtonSubtext: {
    color: "#B8D5C4",
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
  paymentModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: Platform.OS === 'web' ? '50%' : '100%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#20372A",
    textAlign: "center",
    marginBottom: 20,
  },
  bankDetails: {
    backgroundColor: "#F7FAF3",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  bankTitle: {
    fontWeight: "700",
    color: "#2E6B4D",
    marginBottom: 10,
  },
  bankText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#35513F",
  },
  accountNumber: {
    fontWeight: "700",
    color: "#1E3A2F",
  },
  instruction: {
    fontSize: 14,
    color: "#4C6454",
    marginBottom: 16,
    textAlign: "center",
  },
  uploadButton: {
    backgroundColor: "#ECF2E5",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  uploadButtonText: {
    color: "#2E6B4D",
    fontWeight: "700",
  },
  fileName: {
    textAlign: "center",
    color: "#2E6B4D",
    fontSize: 13,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  submissionDetailCard: {
    backgroundColor: "#F7FAF3",
    borderWidth: 1,
    borderColor: "#E3EBDD",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  submissionDetailRow: {
    color: "#35513F",
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 6,
  },
  submissionDetailLabel: {
    fontWeight: "700",
    color: "#2E6B4D",
  },
  submissionDetailValue: {
    color: "#35513F",
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DDE8D6",
  },
  cancelButtonText: {
    color: "#6A7A67",
    fontWeight: "700",
  },
  submitButton: {
    flex: 1,
    backgroundColor: "#2E6B4D",
    padding: 14,
    alignItems: "center",
    borderRadius: 12,
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  disabledTopic: {
    opacity: 0.6,
  },
  lockedBadge: {
    fontSize: 16,
    marginLeft: 8,
  },
  lockedOverlay: {
    margin: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 40,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5EBDD",
  },
  lockIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  lockTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#20372A",
    marginBottom: 8,
  },
  lockSubtitle: {
    fontSize: 15,
    color: "#6A7A67",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  paymentStatusBanner: {
    margin: 16,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  pendingText: {
    color: '#F59E0B',
    fontWeight: '700',
    fontSize: 15,
  },
  rejectedText: {
    color: '#C73737',
    fontWeight: '700',
    fontSize: 15,
  },
  unpaidText: {
    color: '#C73737',
    fontWeight: '700',
    fontSize: 15,
  },

  lockedOverlay: {
    margin: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5EBDD',
  },
  lockIcon: { fontSize: 48, marginBottom: 12 },
  lockTitle: { fontSize: 22, fontWeight: '800', color: '#20372A', marginBottom: 8 },
  lockSubtitle: { fontSize: 15, color: '#6A7A67', textAlign: 'center', lineHeight: 22 },

  disabledTopic: { opacity: 0.55 },
  lockedBadge: { fontSize: 16, marginLeft: 8, color: '#C73737' },

  paymentButton: {
    marginTop: 12,
    backgroundColor: '#2E6B4D',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  paymentButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  fullModalContainer: {
    flex: 1,
    backgroundColor: '#F7F9F4',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  }
});

export default withRoleGuard(ModuleScreen, {
  allowedRoles: ["User", "Admin"],
  screenName: "Module",
});
