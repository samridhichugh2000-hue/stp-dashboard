/**
 * Restore FAQs and Documents from Convex export into Turso.
 * Run: node scripts/seed-faqs-docs.mjs
 */

import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { resolve } from "path";

// Parse .env.local manually (no dotenv dependency needed)
const envFile = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
for (const line of envFile.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// ── FAQs from Convex export ───────────────────────────────────────────────────

const faqs = [
  {
    question: "I need a new SIM for international calling. Will the company provide it?",
    answer: "No. The SIM must be purchased by you.\n\nHowever, the recharge expenses for client calling can be reimbursed under the WFH Infrastructure policy, subject to guidelines.",
    category: "General",
    createdAt: "2026-03-04T06:24:48.893Z",
  },
  {
    question: "For how many days will I be in training?",
    answer: "The training duration is typically 12 to 14 days, depending on your learning pace and grasp of the system.",
    category: "Training",
    createdAt: "2026-03-04T06:09:42.147Z",
  },
  {
    question: "Will I be completely in training and not handling leads?",
    answer: "No. During the training period, you will not only attend training sessions but will also learn and understand the RMS system. Additionally, you will work closely with your manager on practical aspects such as lead handling, call shadowing, and understanding the overall workflow.",
    category: "Training",
    createdAt: "2026-03-04T06:22:09.240Z",
  },
  {
    question: "What WFH capability parameters should I ensure compliance with?",
    answer: "The following are considered non-compliance indicators:\na) Joining meetings late b) Excessive background disturbance. c) Not responding to emails. d) Giving unclear or indirect answers in follow-up discussions. e) Not following basic instructions and justifying errors instead of correcting them. f)\nFrequent network or laptop issues without resolution. \n\nAny violation of the above may lead to disciplinary action.",
    category: "Performance",
    createdAt: "2026-03-04T06:28:01.692Z",
  },
  {
    question: "How will I be monitored during training? Are there specific parameters I should take care of?",
    answer: "Yes. The following parameters are monitored:\n\na) Timeliness and consistency in work. b) Timely submission of assigned tasks. c) Attending all meetings punctually. d) Maintaining a Qubits score above 50. e) Active participation and attentiveness during training. f) Proper reporting in case of unavailability. g) Maintaining professional WFH etiquette. These expectations apply not only during training but throughout your employment.",
    category: "Performance",
    createdAt: "2026-03-04T06:26:36.815Z",
  },
  {
    question: "When will I receive my NJ Kit?",
    answer: "If you have not yet received your NJ Kit, please wait for 2–3 more days from date of your joining. \nIf it is still not delivered, report the same to Samridhi for further coordination.",
    category: "General",
    createdAt: "2026-03-04T06:23:00.449Z",
  },
  {
    question: "Is it mandatory to open a salary account with ICICI?",
    answer: "No, it is not mandatory to open an ICICI salary account.\nHowever, if you open the account through Koenig, it will be treated as a salary account, offering benefits such as:\na) No minimum balance requirement\nb) Other salary account privileges as applicable",
    category: "General",
    createdAt: "2026-03-04T06:23:39.834Z",
  },
];

// ── Documents from Convex export ──────────────────────────────────────────────

const docs = [
  {
    title: "Kites G",
    category: "Policy",
    linkUrl: "https://koenigsolutionsltd-my.sharepoint.com/:w:/r/personal/samridhi_chugh_koenig-solutions_com/_layouts/15/Doc.aspx?sourcedoc=%7B9C76D044-B8E3-47CC-AD28-36FB75A5CD21%7D&file=Koenig%20-%20Kites%20G%2026th%20Dec%201.docx&action=default&mobileredirect=true",
    uploadedBy: "Admin",
    uploadedAt: "2026-03-04T13:21:19.728Z",
  },
  {
    title: "Training Plan",
    category: "Training Plan",
    linkUrl: "https://koenigsolutionsltd-my.sharepoint.com/:w:/g/personal/samridhi_chugh_koenig-solutions_com/IQCj6TEFFFLtR4xe-xjYb_fEAXAI5erm1ElvKaguZfGCg3c",
    uploadedBy: "Admin",
    uploadedAt: "2026-03-04T06:55:41.396Z",
  },
  {
    title: "General Policy",
    category: "Policy",
    linkUrl: "https://rms.koenig-solutions.com/Sync_data/Forms/CRM/Files/EmpPolicy/202634870-GeneralPolicy.pdf",
    uploadedBy: "Admin",
    uploadedAt: "2026-03-04T13:15:51.790Z",
  },
  {
    title: "SOS",
    category: "SOS",
    linkUrl: "https://koenigsolutionsltd.sharepoint.com/:w:/r/sites/STP/_layouts/15/Doc.aspx?sourcedoc=%7B39A44ED4-FBAF-40D1-A8C9-3A5088BFD1BF%7D&file=Koenig%20-%20SOS%2010%20Feb%202026.docx&action=default&mobileredirect=true",
    uploadedBy: "Admin",
    uploadedAt: "2026-03-04T06:54:19.855Z",
  },
];

async function seed() {
  // ── FAQs ──────────────────────────────────────────────────────────────────
  const existingFaqs = await client.execute("SELECT COUNT(*) as count FROM faqs");
  const faqCount = existingFaqs.rows[0].count;

  if (faqCount > 0) {
    console.log(`FAQs table already has ${faqCount} rows — skipping FAQ seed.`);
  } else {
    for (const faq of faqs) {
      await client.execute({
        sql: `INSERT INTO faqs (question, answer, category, created_at) VALUES (?, ?, ?, ?)`,
        args: [faq.question, faq.answer, faq.category, faq.createdAt],
      });
    }
    console.log(`✓ Inserted ${faqs.length} FAQs`);
  }

  // ── Documents ─────────────────────────────────────────────────────────────
  const existingDocs = await client.execute("SELECT COUNT(*) as count FROM documents");
  const docCount = existingDocs.rows[0].count;

  if (docCount > 0) {
    console.log(`Documents table already has ${docCount} rows — skipping document seed.`);
  } else {
    for (const doc of docs) {
      await client.execute({
        sql: `INSERT INTO documents (title, category, link_url, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?)`,
        args: [doc.title, doc.category, doc.linkUrl, doc.uploadedBy, doc.uploadedAt],
      });
    }
    console.log(`✓ Inserted ${docs.length} documents`);
  }

  console.log("Done.");
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
