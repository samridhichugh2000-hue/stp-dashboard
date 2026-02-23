import { internalMutation } from "../_generated/server";

/**
 * Full comprehensive seed — 10 NJs + all related records.
 * Run once: npx convex run seeds/fullSeed:seedAll
 */
export const seedAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    // ─── Wipe existing seed data ─────────────────────────────────────────
    const tables = [
      "newJoiners",
      "qubitScores",
      "leads",
      "nrRecords",
      "roiRecords",
      "rcbClaims",
      "huddleLogs",
      "performanceAlerts",
      "assessmentChecklists",
      "syncLogs",
    ] as const;

    for (const table of tables) {
      const rows = await ctx.db.query(table).collect();
      for (const row of rows) await ctx.db.delete(row._id);
    }

    const existingUsers = await ctx.db.query("users").collect();
    for (const u of existingUsers) {
      if (u.email.includes("seed.stp")) await ctx.db.delete(u._id);
    }

    // ─── Users ────────────────────────────────────────────────────────────
    await ctx.db.insert("users", {
      name: "Admin User",
      email: "admin@seed.stp",
      role: "admin",
    });

    const mgr1 = await ctx.db.insert("users", {
      name: "Deepak Sharma",
      email: "deepak@seed.stp",
      role: "manager",
      teamId: "team_north",
    });

    const mgr2 = await ctx.db.insert("users", {
      name: "Kavitha Rao",
      email: "kavitha@seed.stp",
      role: "manager",
      teamId: "team_south",
    });

    const mgr3 = await ctx.db.insert("users", {
      name: "Rohit Nair",
      email: "rohit@seed.stp",
      role: "manager",
      teamId: "team_west",
    });

    // ─── New Joiners ──────────────────────────────────────────────────────
    const TODAY = new Date("2026-02-20");
    function daysBack(n: number) {
      const d = new Date(TODAY);
      d.setDate(d.getDate() - n);
      return d.toISOString().split("T")[0];
    }

    type Phase = "Orientation" | "Training" | "Field" | "Graduated";
    type Category =
      | "Developed"
      | "Performer"
      | "Performance Falling"
      | "Non-Performer"
      | "Uncategorised";

    const njDefs: {
      name: string;
      days: number;
      mgr: string;
      phase: Phase;
      cat: Category;
      teamId: string;
    }[] = [
      {
        name: "Priya Sharma",
        days: 120,
        mgr: mgr1,
        phase: "Field",
        cat: "Developed",
        teamId: "team_north",
      },
      {
        name: "Rahul Mehta",
        days: 95,
        mgr: mgr1,
        phase: "Field",
        cat: "Performer",
        teamId: "team_north",
      },
      {
        name: "Ananya Iyer",
        days: 80,
        mgr: mgr2,
        phase: "Training",
        cat: "Performer",
        teamId: "team_south",
      },
      {
        name: "Karan Verma",
        days: 65,
        mgr: mgr2,
        phase: "Training",
        cat: "Performance Falling",
        teamId: "team_south",
      },
      {
        name: "Sneha Patel",
        days: 50,
        mgr: mgr1,
        phase: "Orientation",
        cat: "Uncategorised",
        teamId: "team_north",
      },
      {
        name: "Vikram Singh",
        days: 105,
        mgr: mgr3,
        phase: "Field",
        cat: "Developed",
        teamId: "team_west",
      },
      {
        name: "Meera Krishnan",
        days: 88,
        mgr: mgr3,
        phase: "Field",
        cat: "Performer",
        teamId: "team_west",
      },
      {
        name: "Arjun Bose",
        days: 55,
        mgr: mgr2,
        phase: "Training",
        cat: "Non-Performer",
        teamId: "team_south",
      },
      {
        name: "Divya Reddy",
        days: 30,
        mgr: mgr3,
        phase: "Orientation",
        cat: "Uncategorised",
        teamId: "team_west",
      },
      {
        name: "Siddharth Joshi",
        days: 115,
        mgr: mgr1,
        phase: "Graduated",
        cat: "Developed",
        teamId: "team_north",
      },
    ];

    const njIds: string[] = [];
    for (const def of njDefs) {
      const id = await ctx.db.insert("newJoiners", {
        name: def.name,
        joinDate: daysBack(def.days),
        managerId: def.mgr,
        currentPhase: def.phase,
        category: def.cat,
        tenureMonths: Math.floor(def.days / 30),
        isActive: true,
        teamId: def.teamId,
      });
      njIds.push(id);
    }

    // ─── Qubit Scores — 14 scores per NJ ─────────────────────────────────
    // Base quality per NJ (higher = better trained)
    const qubitBase = [82, 75, 70, 55, 50, 88, 78, 42, 48, 90];
    const qubitCategories = ["Pitch", "Objection Handling", "Closing", "Rapport Building", "Product Knowledge"];
    for (let ni = 0; ni < njIds.length; ni++) {
      for (let w = 0; w < 14; w++) {
        const base = qubitBase[ni];
        const variance = Math.round((Math.random() - 0.4) * 20);
        const score = Math.min(100, Math.max(10, base + variance));
        await ctx.db.insert("qubitScores", {
          njId: njIds[ni] as any,
          date: daysBack(w * 2),
          score,
          category: qubitCategories[w % qubitCategories.length],
          recordingsCompleted: Math.floor(Math.random() * 4) + 1,
        });
      }
    }

    // ─── Leads — 5 per NJ ────────────────────────────────────────────────
    const leadStatuses = [
      "New",
      "Contacted",
      "Qualified",
      "Proposal",
      "Won",
      "Lost",
      "Stale",
    ] as const;
    const corpNames = [
      "Infosys",
      "TCS",
      "Wipro",
      "HCL",
      "Tech Mahindra",
      "Capgemini",
      "Accenture",
      "Cognizant",
      "Reliance",
      "HDFC Bank",
      "ICICI Bank",
      "Axis Bank",
      "Kotak",
      "SBI Life",
      "Bajaj Allianz",
      "Max Life",
      "TATA AIA",
      "Birla Sun Life",
      "Aditya Birla",
      "L&T Finance",
    ];
    let leadCounter = 1000;
    for (let ni = 0; ni < njIds.length; ni++) {
      for (let l = 0; l < 5; l++) {
        leadCounter++;
        const allocDays = Math.floor(Math.random() * 40) + 5;
        const actionDays = Math.floor(Math.random() * allocDays);
        const tatHours = Math.round(Math.random() * 96) + 1;
        const status = leadStatuses[Math.floor(Math.random() * leadStatuses.length)];
        await ctx.db.insert("leads", {
          njId: njIds[ni] as any,
          leadId: `LEAD-${leadCounter}`,
          allocatedDate: daysBack(allocDays),
          lastActionDate: daysBack(actionDays),
          status,
          tatHours,
          tatBreached: tatHours > 48,
          isSelfGen: Math.random() > 0.7,
        });
      }
    }

    // ─── NR Records — 8 months per NJ ────────────────────────────────────
    const nrBase = [280000, 195000, 170000, 80000, 50000, 320000, 210000, 30000, 45000, 360000];
    for (let ni = 0; ni < njIds.length; ni++) {
      for (let m = 0; m < 8; m++) {
        const monthOffset = 7 - m;
        const refDate = new Date(TODAY);
        refDate.setMonth(refDate.getMonth() - monthOffset);
        const variance = (Math.random() - 0.35) * nrBase[ni] * 0.4;
        const nrValue = Math.round(nrBase[ni] + variance);
        await ctx.db.insert("nrRecords", {
          njId: njIds[ni] as any,
          month: refDate.getMonth() + 1,
          year: refDate.getFullYear(),
          nrValue,
          isPositive: nrValue > 0,
          source: Math.random() > 0.2 ? "RMS" : "Manual",
        });
      }
    }

    // ─── ROI Records — 8 weeks per NJ ────────────────────────────────────
    const roiBase = [3.2, 2.1, 1.8, 0.8, 0.5, 3.8, 2.5, 0.3, 0.4, 4.1];
    for (let ni = 0; ni < njIds.length; ni++) {
      for (let w = 0; w < 8; w++) {
        // Monday of that week
        const d = new Date(TODAY);
        d.setDate(d.getDate() - w * 7 - d.getDay() + 1);
        const roi = roiBase[ni] + (Math.random() - 0.4) * 1.5;
        const color =
          roi >= 3 ? "Green" : roi >= 1.5 ? "Yellow" : roi >= 0.5 ? "Red" : ("Black" as const);
        await ctx.db.insert("roiRecords", {
          njId: njIds[ni] as any,
          weekStart: d.toISOString().split("T")[0],
          roiValue: Math.round(roi * 100) / 100,
          colorCode: color,
        });
      }
    }

    // ─── RCB Claims — 2-3 per NJ ─────────────────────────────────────────
    const rcbStatuses = ["Pending", "Approved", "Rejected", "Under Review"] as const;
    for (let ni = 0; ni < njIds.length; ni++) {
      const claimCount = Math.floor(Math.random() * 2) + 2;
      for (let c = 0; c < claimCount; c++) {
        await ctx.db.insert("rcbClaims", {
          njId: njIds[ni] as any,
          corporateName: corpNames[(ni * 3 + c) % corpNames.length],
          claimDate: daysBack(Math.floor(Math.random() * 60) + 5),
          status: rcbStatuses[Math.floor(Math.random() * rcbStatuses.length)],
          revenueLinked: Math.round(Math.random() * 900000 + 100000),
        });
      }
    }

    // ─── Huddle Logs — 6 per NJ ──────────────────────────────────────────
    const huddleTypes = ["Daily", "Weekly", "Monthly", "Ad-hoc"] as const;
    const conductors = ["Deepak Sharma", "Kavitha Rao", "Rohit Nair"];
    for (let ni = 0; ni < njIds.length; ni++) {
      for (let h = 0; h < 6; h++) {
        await ctx.db.insert("huddleLogs", {
          njId: njIds[ni] as any,
          date: daysBack(h * 4),
          type: huddleTypes[h % huddleTypes.length],
          conductedBy: conductors[ni % conductors.length],
          completed: h < 5,
          notes: h === 0 ? "Good progress this week. Focus on pipeline conversion." : undefined,
        });
      }
    }

    // ─── Performance Alerts ───────────────────────────────────────────────
    const alertTypes = ["PA", "PIP", "EXIT"] as const;
    // Karan Verma (idx 3) - Performance Falling → PA
    await ctx.db.insert("performanceAlerts", {
      njId: njIds[3] as any,
      alertType: "PA",
      triggeredAt: new Date(TODAY.getTime() - 10 * 86400000).toISOString(),
    });
    // Arjun Bose (idx 7) - Non-Performer → PIP
    await ctx.db.insert("performanceAlerts", {
      njId: njIds[7] as any,
      alertType: "PIP",
      triggeredAt: new Date(TODAY.getTime() - 5 * 86400000).toISOString(),
    });
    // Sneha Patel (idx 4) - Uncategorised → PA acknowledged
    await ctx.db.insert("performanceAlerts", {
      njId: njIds[4] as any,
      alertType: "PA",
      triggeredAt: new Date(TODAY.getTime() - 20 * 86400000).toISOString(),
      acknowledgedAt: new Date(TODAY.getTime() - 18 * 86400000).toISOString(),
      acknowledgedBy: "Deepak Sharma",
    });

    // ─── Assessment Checklists — 1 per NJ ────────────────────────────────
    const outcomes = ["Pass", "Fail", "Pending", "Deferred"] as const;
    for (let ni = 0; ni < njIds.length; ni++) {
      await ctx.db.insert("assessmentChecklists", {
        njId: njIds[ni] as any,
        filledBy: conductors[ni % conductors.length],
        filledAt: daysBack(Math.floor(Math.random() * 30) + 5),
        outcome: outcomes[ni % outcomes.length],
        managerNotes: "Reviewed in monthly session.",
      });
    }

    // ─── Sync Logs ────────────────────────────────────────────────────────
    const modules = ["Qubits", "Leads", "NRD", "ROI", "RCB"];
    for (const mod of modules) {
      await ctx.db.insert("syncLogs", {
        module: mod,
        lastSyncAt: new Date(TODAY.getTime() - Math.random() * 3600000).toISOString(),
        status: "success",
        recordsProcessed: Math.floor(Math.random() * 200) + 50,
      });
    }

    console.log(
      `Seeded: 10 NJs, 140 qubit scores, 50 leads, 80 NR records, 80 ROI records, 25+ RCB claims, 60 huddle logs, 3 alerts, 10 checklists, 5 sync logs`
    );

    return { njIds, njCount: njIds.length };
  },
});
