import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Seed initial users and new joiners.
 * Run once: npx convex run seeds/users
 */
export const seedUsers = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Clear existing seed data
    const existingUsers = await ctx.db.query("users").collect();
    for (const u of existingUsers) {
      if (u.email.includes("seed.stp")) {
        await ctx.db.delete(u._id);
      }
    }

    // Create admin user
    const adminId = await ctx.db.insert("users", {
      name: "Admin User",
      email: "admin@seed.stp",
      role: "admin",
    });

    // Create manager users
    const manager1Id = await ctx.db.insert("users", {
      name: "Deepak Sharma",
      email: "deepak@seed.stp",
      role: "manager",
      teamId: "team_north",
    });

    const manager2Id = await ctx.db.insert("users", {
      name: "Kavitha Rao",
      email: "kavitha@seed.stp",
      role: "manager",
      teamId: "team_south",
    });

    // Create NJ users
    const njUsers = [
      { name: "Priya Sharma", email: "priya@seed.stp", teamId: "team_north" },
      { name: "Rahul Mehta", email: "rahul@seed.stp", teamId: "team_north" },
      { name: "Ananya Iyer", email: "ananya@seed.stp", teamId: "team_south" },
      { name: "Karan Verma", email: "karan@seed.stp", teamId: "team_south" },
      { name: "Sneha Patel", email: "sneha@seed.stp", teamId: "team_north" },
    ];

    const njUserIds: string[] = [];
    for (const nj of njUsers) {
      const id = await ctx.db.insert("users", {
        name: nj.name,
        email: nj.email,
        role: "nj",
        teamId: nj.teamId,
      });
      njUserIds.push(id);
    }

    // Seed New Joiners with varied join dates and categories
    const today = new Date("2026-02-20");
    const njData = [
      {
        name: "Priya Sharma",
        daysAgo: 95,
        managerId: manager1Id,
        phase: "Field" as const,
        category: "Developed" as const,
      },
      {
        name: "Rahul Mehta",
        daysAgo: 75,
        managerId: manager1Id,
        phase: "Field" as const,
        category: "Performer" as const,
      },
      {
        name: "Ananya Iyer",
        daysAgo: 60,
        managerId: manager2Id,
        phase: "Training" as const,
        category: "Performer" as const,
      },
      {
        name: "Karan Verma",
        daysAgo: 45,
        managerId: manager2Id,
        phase: "Training" as const,
        category: "Performance Falling" as const,
      },
      {
        name: "Sneha Patel",
        daysAgo: 30,
        managerId: manager1Id,
        phase: "Orientation" as const,
        category: "Uncategorised" as const,
      },
    ];

    const njIds: string[] = [];
    for (const nj of njData) {
      const joinDate = new Date(today);
      joinDate.setDate(joinDate.getDate() - nj.daysAgo);
      const tenureMonths = Math.floor(nj.daysAgo / 30);

      const id = await ctx.db.insert("newJoiners", {
        name: nj.name,
        joinDate: joinDate.toISOString().split("T")[0],
        managerId: nj.managerId,
        currentPhase: nj.phase,
        category: nj.category,
        tenureMonths,
        isActive: true,
      });
      njIds.push(id);
    }

    // Seed huddle logs
    for (const njId of njIds) {
      const types = ["Daily", "Weekly", "Monthly"] as const;
      for (let i = 0; i < 5; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i * 3);
        await ctx.db.insert("huddleLogs", {
          njId: njId as any,
          date: date.toISOString().split("T")[0],
          type: types[i % 3],
          conductedBy: "Deepak Sharma",
          completed: i < 4,
        });
      }
    }

    // Seed performance alerts for oldest NJ
    if (njIds.length > 0) {
      await ctx.db.insert("performanceAlerts", {
        njId: njIds[0] as any,
        alertType: "PA",
        triggeredAt: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    console.log(
      `Seeded: 1 admin, 2 managers, 5 NJ users, 5 newJoiners, huddle logs, 1 alert`
    );
    return {
      adminId,
      manager1Id,
      manager2Id,
      njUserIds,
      njIds,
    };
  },
});
