import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
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

const MODULE_SECTIONS = [
  {
    id: "section-1",
    title: "1.1 Conservation",
    contentHtml:
      "<p>Conservation protects natural resources, biodiversity, and ecosystems in Sarawak parks. Guides help visitors understand low-impact behavior and why protection matters for future generations.</p>",
  },
  {
    id: "section-2",
    title: "1.2 Biodiversity",
    contentHtml:
      "<p>Biodiversity is the variety of life across habitats and species. Strong biodiversity improves ecosystem resilience and visitor learning outcomes.</p>",
  },
  {
    id: "section-3",
    title: "1.3 Eco-tourism",
    contentHtml:
      "<p>Eco-tourism balances visitor experience, local community benefit, and conservation outcomes through responsible travel practices.</p>",
  },
  {
    id: "section-4",
    title: "1.4 Legislation",
    contentHtml:
      "<p>Guides should understand major legal frameworks, park rules, and protected-area ordinances relevant to visitor control.</p>",
  },
  {
    id: "section-5",
    title: "1.5 Safety",
    contentHtml:
      "<p>Follow incident response SOPs for lost hikers, injuries, weather shifts, and wildlife encounters.</p>",
  },
];

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

const TRACK_SUMMARY = {
  General: "Conservation • Biodiversity • Eco-tourism • Legislation • Safety",
  "Park 1": "Park 1 Training Track",
  "Park 2": "Park 2 Training Track",
  "Park 3": "Park 3 Training Track",
  "Park 4": "Park 4 Training Track",
  "Park 5": "Park 5 Training Track",
};

function stripHtmlContent(value) {
  if (!value) {
    return "";
  }

  return String(value)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeRichHtml(value) {
  return String(value || "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+="[^"]*"/gi, "")
    .replace(/\son[a-z]+='[^']*'/gi, "");
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
  const userLabel =
    currentProfile?.fullName || currentProfile?.username || "Guide";

  const [moduleDisplayName, setModuleDisplayName] = useState(routeModuleName);
  const moduleSummary =
    TRACK_SUMMARY[moduleDisplayName] || TRACK_SUMMARY.General;
  const progressionUnlocked =
    isAdmin || route?.params?.progressionUnlocked !== false;
  const progressionLockReason =
    route?.params?.progressionLockReason ||
    "Complete the required previous assessment to unlock this one.";

  const [sections, setSections] = useState(MODULE_SECTIONS);
  const [selectedSectionId, setSelectedSectionId] = useState(
    MODULE_SECTIONS[0].id,
  );
  const [visitedSectionIds, setVisitedSectionIds] = useState(new Set());
  const [expandedSectionIds, setExpandedSectionIds] = useState(new Set());
  const [loading, setLoading] = useState(Boolean(routeModuleId));
  const [isOnSite, setIsOnSite] = useState(false);

  const [paymentStatus, setPaymentStatus] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(true);

  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null); 

  const BANK_DETAILS = {
    bankName: "Maybank Islamic Berhad",
    accountName: "Sarawak Parks Training Academy",
    accountNumber: "1234 5678 9012 3456",
    referenceFormat: `MOD-${routeModuleId || "XXXX"}-${currentProfile?.username || "USER"}`,
  };

  const isPaid = paymentStatus === "paid";
  const isPaymentPending = paymentStatus === "pending";

  const fetchPaymentStatus = async () => {
    if (!routeModuleId || isAdmin) {
      setPaymentStatus("paid");
      setPaymentLoading(false);
      return;
    }

    try {
      const token = await AsyncStorage.getItem("innopapp_auth_token");
      const response = await requestProfileApi(
        `/api/v1/modules/${routeModuleId}/payment-status`,
        token,
        { method: "GET" },
      );

      setPaymentStatus(response?.data?.status || "unpaid");
    } catch (error) {
      console.warn("Failed to fetch payment status:", error);
      setPaymentStatus("unpaid");
    } finally {
      setPaymentLoading(false);
    }
  };

  const pickPaymentEvidence = async () => {
    if (isWeb) {
      fileInputRef.current?.click();
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.length > 0) {
        const file = result.assets[0];
        setSelectedFile({
          name: file.name,
          uri: file.uri,
          type: file.mimeType || 'application/pdf',
        });
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to pick file');
    }
  };

  const handleWebFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type === "application/pdf") {
      setSelectedFile({
        name: file.name,
        uri: URL.createObjectURL(file),
        type: file.type,
        fileObject: file,
      });
    } else {
      Alert.alert("Invalid File", "Please select a PDF file only.");
    }
  };

  const submitPaymentEvidence = async () => {
    if (!selectedFile) {
      Alert.alert("Missing File", "Please upload your payment receipt (PDF)");
      return;
    }

    setIsSubmitting(true);

    try {
      const token = await AsyncStorage.getItem("innopapp_auth_token");
      if (!token) throw new Error("No session");

      const formData = new FormData();

      formData.append("moduleId", routeModuleId);
      formData.append("reference", BANK_DETAILS.referenceFormat);

      if (isWeb && selectedFile.fileObject) {
        formData.append("evidence", selectedFile.fileObject);
      } else if (selectedFile.uri) {
        formData.append("evidence", {
          uri: selectedFile.uri,
          name: selectedFile.name,
          type: selectedFile.type || "application/pdf",
        });
      }

      const response = await requestProfileApi(
        "/api/v1/enrollment/submit-payment",
        token,
        {
          method: "POST",
          body: formData,
        },
      );

      if (response?.success || response?.ok) {
        Alert.alert(
          "✅ Submitted",
          "Payment evidence submitted successfully. Admin will review it.",
        );
        setPaymentModalVisible(false);
        setSelectedFile(null);
        setPaymentStatus("pending");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to submit payment evidence.");
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
      setSections(MODULE_SECTIONS);
      setSelectedSectionId(MODULE_SECTIONS[0]?.id || null);
      setVisitedSectionIds(
        MODULE_SECTIONS[0]?.id ? new Set([MODULE_SECTIONS[0].id]) : new Set(),
      );
      setExpandedSectionIds(new Set());
      setModuleDisplayName(routeModuleName);
      setLoading(false);
      return;
    }

    fetchPaymentStatus();

    let active = true;

    const loadModuleContent = async () => {
      setLoading(true);
      setVisitedSectionIds(new Set());

      try {
        const token = await AsyncStorage.getItem("innopapp_auth_token");

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
                  contentText: stripHtmlContent(
                    sub.content || sub.contentHtml || "",
                  ),
                  parentId: secId,
                }))
              : [];

            groupedSections.push({
              id: secId,
              title,
              description,
              contentHtml: "",
              contentText: description || "",
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
                contentText: stripHtmlContent(contentHtml),
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
                contentText: "",
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
                contentText: stripHtmlContent(contentHtml),
                parentId: section.id,
              });
              return;
            }

            if (!section.contentHtml) {
              section.contentHtml = contentHtml;
              section.contentText = stripHtmlContent(contentHtml);
            }
          });
        }

        const formattedSections = groupedSections;

        if (active) {
          setSections(formattedSections);
          setSelectedSectionId(formattedSections[0]?.id || null);
          setExpandedSectionIds(new Set());

          try {
            const token = await AsyncStorage.getItem("innopapp_auth_token");
            const savedProgress = await fetchModuleProgress(
              routeModuleId,
              token,
            );

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
            setVisitedSectionIds(
              formattedSections[0]?.id
                ? new Set([formattedSections[0].id])
                : new Set(),
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

    loadModuleContent();

    return () => {
      active = false;
    };
  }, [routeModuleId]);

  const canAccessContent = isAdmin || isPaid || isOnSite;

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
        const token = await AsyncStorage.getItem("innopapp_auth_token");
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
            const token = await AsyncStorage.getItem("innopapp_auth_token");
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

        {loading || paymentLoading ? (
          <View style={styles.loadingPanel}>
            <ActivityIndicator size="large" color="#2E6B4D" />
            <Text style={styles.loadingText}>Loading module content...</Text>
          </View>
        ) : (
          !isAdmin &&
          !isOnSite &&
          paymentStatus &&
          paymentStatus !== "paid" && (
            <View style={styles.paymentStatusBanner}>
              {paymentStatus === "pending" && (
                <Text style={styles.pendingText}>
                  ⏳ Payment Pending Review
                </Text>
              )}
              {paymentStatus === "rejected" && (
                <Text style={styles.rejectedText}>
                  ❌ Payment Rejected - Please submit again
                </Text>
              )}
              {paymentStatus === "unpaid" && (
                <Text style={styles.unpaidText}>
                  🔒 Payment Required to Access This Module
                </Text>
              )}
            </View>
          )
        )}

        {!isPaid && !isAdmin && !isOnSite ? (
          <View style={styles.lockedOverlay}>
            <Text style={styles.lockIcon}>🔒</Text>
            <Text style={styles.lockTitle}>Payment Required</Text>
            <Text style={styles.lockSubtitle}>
              Complete payment to access this module content and assessment.
            </Text>

            <TouchableOpacity
              style={styles.paymentButton}
              onPress={() => setPaymentModalVisible(true)}
            >
              <Text style={styles.paymentButtonText}>💰 Make Payment Now</Text>
            </TouchableOpacity>
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

              {!isAdmin && !isOnSite && routeModuleId && (
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
                    : isOnSite
                      ? "On-site module — no assessment"
                      : !progressionUnlocked
                        ? "Locked by Learning Pathway"
                        : assessmentUnlocked
                          ? "Take Assessment"
                          : "Review Sections First"}
                </Text>
                <Text style={styles.assessmentArrow}>{">"}</Text>
              </TouchableOpacity>
              {isOnSite ? (
                <Text style={styles.assessmentHintText}>
                  This on-site module has no assessment. Completion is recorded
                  by an admin after training.
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
            </View>

            <Text style={styles.instruction}>
              Transfer the fee and upload your receipt (PDF)
            </Text>

            <TouchableOpacity
              style={styles.uploadButton}
              onPress={pickPaymentEvidence}
            >
              <Text style={styles.uploadButtonText}>
                {selectedFile
                  ? "📄 Change Receipt"
                  : "📎 Upload Payment Receipt (PDF)"}
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

      {isWeb && (
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
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
    padding: 20,
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
  paymentModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
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
