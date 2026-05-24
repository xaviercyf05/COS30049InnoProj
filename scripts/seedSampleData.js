const bcrypt = require("bcryptjs");
const { query, pool } = require("../src/config/db");

/**
 * Seed script to populate sample data for testing
 * Usage: node scripts/seedSampleData.js
 */

const SECTIONS = [
  "Conservation",
  "Biodiversity",
  "Eco-tourism",
  "Legislation",
  "Safety",
];

async function seedRolesAndUsers() {
  console.log("Seeping roles and users...");

  // Roles should already exist, but verify
  const [roles] = await query(
    "SELECT COUNT(*) as count FROM Roles WHERE RoleTitle IN ('Admin', 'User')"
  );

  if (roles[0].count < 2) {
    await query(
      "INSERT IGNORE INTO Roles (RoleTitle, Description) VALUES (?, ?)",
      ["User", "Park guide or ranger with learning access"]
    );
  }

  // Create test users
  const testUsers = [
    {
      username: "guide_john",
      password: "guide_john123",
      fullName: "John Park Guide",
      emailPrefix: "john_guide",
      role: "User",
    },
    {
      username: "guide_sarah",
      password: "guide_sarah123",
      fullName: "Sarah Nature Ranger",
      emailPrefix: "sarah_ranger",
      role: "User",
    },
    {
      username: "guide_mike",
      password: "guide_mike123",
      fullName: "Mike Conservation Expert",
      emailPrefix: "mike_conservation",
      role: "User",
    },
  ];

  for (const user of testUsers) {
    const [existing] = await query(
      "SELECT UserID FROM Users WHERE Username = ? LIMIT 1",
      [user.username]
    );

    if (existing.length === 0) {
      const hashedPassword = await bcrypt.hash(user.password, 12);
      const [roleResult] = await query(
        "SELECT RoleID FROM Roles WHERE RoleTitle = ? LIMIT 1",
        [user.role]
      );

      const roleId = roleResult[0]?.RoleID || 2; // Default to User role ID

      await query(
        `INSERT INTO Users (Username, PasswordHash, FullName, Email, RoleID, IsActive, Status, Progress)
         VALUES (?, ?, ?, ?, ?, 1, 'Active', 0)`,
        [
          user.username,
          hashedPassword,
          user.fullName,
          `${user.emailPrefix}@sarawakparks.my`,
          roleId,
        ]
      );

      console.log(`✓ Created user: ${user.username} (${user.fullName})`);
    }
  }
}

async function seedQualifications() {
  console.log("\nSeeding qualifications...");

  const qualifications = [
    {
      name: "Sarawak National Park Guide Certification",
      description:
        "Complete training program to become a certified national park guide",
    },
    {
      name: "Forest Biodiversity Specialist",
      description: "Advanced certification in tropical forest biodiversity",
    },
    {
      name: "Eco-Tourism Management",
      description: "Certification for sustainable tourism management",
    },
  ];

  for (const qual of qualifications) {
    const [existing] = await query(
      "SELECT QualificationID FROM Qualifications WHERE QualificationName = ? LIMIT 1",
      [qual.name]
    );

    if (existing.length === 0) {
      await query(
        "INSERT INTO Qualifications (QualificationName, Status) VALUES (?, 'Active')",
        [qual.name]
      );

      console.log(`✓ Created qualification: ${qual.name}`);
    }
  }
}

async function seedModules() {
  console.log("\nSeeding modules...");

  const [quals] = await query("SELECT QualificationID FROM Qualifications");

  if (quals.length === 0) {
    console.log("No qualifications found. Skipping modules.");
    return;
  }

  const primaryQualId = quals[0].QualificationID;

  const modules = [
    {
      title: "Module 1: Conservation Fundamentals",
      description:
        "Learn the basics of park conservation and environmental protection",
    },
    {
      title: "Module 2: Biodiversity Deep Dive",
      description: "Explore Sarawak's unique flora and fauna",
    },
    {
      title: "Module 3: Advanced Park Management",
      description: "Master modern park management and visitor safety",
    },
  ];

  for (const mod of modules) {
    const [existing] = await query(
      "SELECT ModuleID FROM Modules WHERE ModuleTitle = ? LIMIT 1",
      [mod.title]
    );

    if (existing.length === 0) {
      await query(
        "INSERT INTO Modules (QualificationID, ModuleTitle) VALUES (?, ?)",
        [primaryQualId, mod.title]
      );

      console.log(`✓ Created module: ${mod.title}`);
    }
  }
}

async function seedMaterials() {
  console.log("\nSeeding learning materials...");

  const [modules] = await query("SELECT ModuleID FROM Modules ORDER BY ModuleID");

  if (modules.length === 0) {
    console.log("No modules found. Skipping materials.");
    return;
  }

  const contentExamples = {
    "Conservation Fundamentals": `
# Welcome to Conservation Fundamentals

Conservation is the practice of preserving biodiversity and ecosystem health for future generations.
Sarawak's national parks are home to some of the world's most endangered species.

## Key Concepts:
1. **Habitat Protection** - Preserving natural spaces
2. **Species Diversity** - Protecting various species
3. **Sustainable Use** - Using resources responsibly
4. **Community Engagement** - Involving local communities

## Your Role:
As a park guide, you are an ambassador for conservation. Your knowledge and passion help visitors
understand the importance of protecting our natural heritage.
    `,
    "Biodiversity Focus": `
# Sarawak's Rich Biodiversity

Sarawak is a biodiversity hotspot with incredible species diversity.

## Flora:
- Over 3,000 plant species
- Many endemic to Sarawak
- Medicinal plants used by indigenous communities

## Fauna:
- Orangutans (critically endangered)
- Proboscis monkeys (endemic to Borneo)
- Asian elephants
- Clouded leopards

## Ecosystem Types:
1. Lowland dipterocarp forests
2. Peat swamp forests
3. Montane forests
4. Coastal mangrove forests
    `,
    "Eco-Tourism Practice": `
# Sustainable Eco-Tourism

Eco-tourism brings economic benefits while supporting conservation.

## Principles:
- Minimize environmental impact
- Respect wildlife and culture
- Support local communities
- Educate visitors about conservation

## Best Practices:
- Keep to designated trails
- Maintain wildlife distances
- Practice leave-no-trace principles
- Support local guides and businesses
    `,
    "Legal Framework": `
# Park Management Laws and Regulations

Sarawak's park system operates under specific legal frameworks.

## Key Legislation:
- National Parks Ordinance (Sarawak)
- Wildlife Protection Ordinance
- Environmental Protection Act
- Land Code of Sarawak

## Your Responsibilities:
- Enforce park regulations
- Protect against poaching and illegal logging
- Report violations
- Educate visitors on rules
    `,
    "Safety Protocols": `
# Guide Safety and Emergency Procedures

Your safety and visitor safety are paramount.

## Personal Safety:
- Always inform someone of your location
- Carry communication devices
- Know emergency contact numbers
- Understand wildlife behavior

## Emergency Response:
- First aid basic training
- How to contact rescue services
- Emergency shelter techniques
- Wildlife encounter protocols

## Visitor Safety:
- Briefing procedures
- Equipment checks
- Trail safety standards
- Weather awareness
    `,
  };

  let materialCount = 0;

  for (let modIndex = 0; modIndex < modules.length; modIndex++) {
    const moduleId = modules[modIndex].ModuleID;

    // Create 5 materials for each section
    for (const section of SECTIONS) {
      const [existing] = await query(
        "SELECT MaterialID FROM LearningMaterials WHERE ModuleID = ? AND Chapter = ? LIMIT 1",
        [moduleId, section]
      );

      if (existing.length === 0) {
        const contentKey = Object.keys(contentExamples)[
          (modIndex * SECTIONS.length + SECTIONS.indexOf(section)) %
            Object.keys(contentExamples).length
        ];
        const content = contentExamples[contentKey];

        await query(
          `INSERT INTO LearningMaterials (ModuleID, Chapter, Title, ContentType, ContentText)
           VALUES (?, ?, ?, 'text', ?)`,
          [
            moduleId,
            section,
            `${section} - Module ${modIndex + 1} Content`,
            content,
          ]
        );

        materialCount++;
      }
    }
  }

  console.log(
    `✓ Created ${materialCount} learning materials (5 per module section)`
  );
}

async function seedAssessments() {
  console.log("\nSeeding assessments...");

  const [modules] = await query("SELECT ModuleID FROM Modules");

  if (modules.length === 0) {
    console.log("No modules found. Skipping assessments.");
    return;
  }

  for (const module of modules) {
    const [existing] = await query(
      "SELECT AssessmentID FROM Assessments WHERE ModuleID = ? LIMIT 1",
      [module.ModuleID]
    );

    if (existing.length === 0) {
      // Create assessment
      const [assessResult] = await query(
        `INSERT INTO Assessments (ModuleID, Title, PassingScore, AttemptLimit)
         VALUES (?, ?, 70, 3)`,
        [module.ModuleID, `Assessment for Module ${module.ModuleID}`]
      );

      const assessmentId = assessResult.insertId;

      // Create 10 sample questions with options
      for (let q = 1; q <= 10; q++) {
        const [qResult] = await query(
          `INSERT INTO AssessmentQuestions (AssessmentID, QuestionText, QuestionType)
           VALUES (?, ?, 'multiple_choice')`,
          [assessmentId, `Question ${q}: Sample question about park management?`]
        );

        const questionId = qResult.insertId;

        // Add 4 options per question (1-3 wrong, 1 correct)
        const options = [
          { text: "First option (incorrect)", isCorrect: q % 4 === 1 ? 1 : 0 },
          { text: "Second option (incorrect)", isCorrect: q % 4 === 2 ? 1 : 0 },
          { text: "Third option (incorrect)", isCorrect: q % 4 === 3 ? 1 : 0 },
          { text: "Fourth option (correct)", isCorrect: q % 4 === 0 ? 1 : 0 },
        ];

        for (const option of options) {
          await query(
            "INSERT INTO AssessmentOptions (QuestionID, OptionText, IsCorrect) VALUES (?, ?, ?)",
            [questionId, option.text, option.isCorrect]
          );
        }
      }

      console.log(`✓ Created assessment for Module ${module.ModuleID}`);
    }
  }
}

async function seedSchedules() {
  console.log("\nSeeding sample schedules...");

  const [users] = await query(
    "SELECT UserID FROM Users WHERE RoleID = (SELECT RoleID FROM Roles WHERE RoleTitle = 'User') LIMIT 3"
  );
  const [quals] = await query(
    "SELECT QualificationID FROM Qualifications LIMIT 1"
  );

  if (users.length === 0 || quals.length === 0) {
    console.log("Insufficient data. Skipping schedules.");
    return;
  }

  const scheduleExamples = [
    {
      title: "Module 1 Theory Session",
      description: "Interactive classroom session covering conservation basics",
      startTime: "09:00:00",
      endTime: "11:30:00",
      daysOffset: 7,
    },
    {
      title: "Field Trip - Forest Walk",
      description: "Practical field experience in the national park",
      startTime: "06:00:00",
      endTime: "14:00:00",
      daysOffset: 14,
    },
    {
      title: "Module 2 Assessment Day",
      description: "Final assessment for Module 2",
      startTime: "10:00:00",
      endTime: "12:00:00",
      daysOffset: 21,
    },
  ];

  for (const user of users) {
    for (const schedule of scheduleExamples) {
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + schedule.daysOffset);

      const [existing] = await query(
        "SELECT ScheduleID FROM Schedules WHERE UserID = ? AND Title = ? LIMIT 1",
        [user.UserID, schedule.title]
      );

      if (existing.length === 0) {
        await query(
          `INSERT INTO Schedules (UserID, QualificationID, Title, Description, EventDate, StartTime, EndTime)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            user.UserID,
            quals[0].QualificationID,
            schedule.title,
            schedule.description,
            eventDate.toISOString().split("T")[0],
            schedule.startTime,
            schedule.endTime,
          ]
        );

        console.log(`✓ Created schedule for user ${user.UserID}: ${schedule.title}`);
      }
    }
  }
}

async function run() {
  try {
    console.log(
      "========================================\nStarting Sample Data Seeding\n========================================\n"
    );

    await seedRolesAndUsers();
    await seedQualifications();
    await seedModules();
    await seedMaterials();
    await seedAssessments();
    await seedSchedules();

    console.log(
      "\n========================================\n✓ Sample Data Seeding Complete!\n========================================\n"
    );

    console.log("Test User Credentials:");
    console.log("  - Username: guide_john | Password: guide_john123");
    console.log("  - Username: guide_sarah | Password: guide_sarah123");
    console.log("  - Username: guide_mike | Password: guide_mike123");
    console.log("\nYou can now test the API using these credentials.");
  } catch (error) {
    console.error("Seeding error:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
