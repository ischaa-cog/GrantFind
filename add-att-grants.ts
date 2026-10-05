import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { grants } from "./shared/schema";
import { eq } from "drizzle-orm";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function addATTGrants() {
  try {
    console.log("Adding 5 new AT&T grants to database...");
    
    const newATTGrants = [
      {
        title: "AT&T 5G Innovation Challenge",
        companyId: 1,
        company: "AT&T",
        amount: 100000,
        deadline: new Date("2025-12-15T17:00:00Z"),
        category: "Technology",
        tags: ["$100k", "5G", "innovation", "telecom"],
        description: "Funding for startups developing innovative 5G applications and solutions that can transform industries.",
        requirements: "Must be developing 5G-enabled technology solutions with clear commercial potential.",
        applicationUrl: "https://example.com/apply/att-5g",
        status: "active",
        rating: 47,
        imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200",
        isNew: true,
        isHot: false,
        timeRemaining: null
      },
      {
        title: "AT&T Digital Divide Bridge Grant",
        companyId: 1,
        company: "AT&T",
        amount: 75000,
        deadline: new Date("2025-11-30T16:00:00Z"),
        category: "Social Impact",
        tags: ["$75k", "digital-divide", "education", "community"],
        description: "Supporting organizations that bridge the digital divide and improve digital literacy in underserved communities.",
        requirements: "Must focus on digital inclusion initiatives for underserved populations.",
        applicationUrl: "https://example.com/apply/att-bridge",
        status: "active",
        rating: 45,
        imageUrl: "https://images.unsplash.com/photo-1509475826633-fed577a2c71b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200",
        isNew: false,
        isHot: true,
        timeRemaining: null
      },
      {
        title: "AT&T Veteran Business Accelerator",
        companyId: 1,
        company: "AT&T",
        amount: 60000,
        deadline: new Date("2026-01-20T15:00:00Z"),
        category: "Veteran-owned Businesses",
        tags: ["$60k", "veterans", "business", "accelerator"],
        description: "Dedicated funding program for veteran-owned businesses in technology and telecommunications sectors.",
        requirements: "Business owner must be a verified military veteran with at least 51% ownership.",
        applicationUrl: "https://example.com/apply/att-veteran",
        status: "active",
        rating: 46,
        imageUrl: "https://images.unsplash.com/photo-1606857521015-7f9fcf423740?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200",
        isNew: false,
        isHot: false,
        timeRemaining: null
      },
      {
        title: "AT&T Smart Cities Innovation Fund",
        companyId: 1,
        company: "AT&T",
        amount: 125000,
        deadline: new Date("2025-09-10T14:00:00Z"),
        category: "Smart Cities",
        tags: ["$125k", "smart-cities", "IoT", "infrastructure"],
        description: "Funding for innovative solutions that make cities smarter, more efficient, and more sustainable through connected technology.",
        requirements: "Must develop IoT or connectivity solutions for urban infrastructure improvement.",
        applicationUrl: "https://example.com/apply/att-smart-cities",
        status: "active",
        rating: 49,
        imageUrl: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200",
        isNew: true,
        isHot: true,
        timeRemaining: "42H : 15M : 30S"
      },
      {
        title: "AT&T Cybersecurity Excellence Grant",
        companyId: 1,
        company: "AT&T",
        amount: 80000,
        deadline: new Date("2025-10-25T13:00:00Z"),
        category: "Cybersecurity",
        tags: ["$80k", "cybersecurity", "enterprise", "security"],
        description: "Supporting startups developing cutting-edge cybersecurity solutions for enterprise and consumer markets.",
        requirements: "Must be developing innovative cybersecurity technology with proven effectiveness.",
        applicationUrl: "https://example.com/apply/att-cyber",
        status: "active",
        rating: 48,
        imageUrl: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200",
        isNew: false,
        isHot: false,
        timeRemaining: null
      }
    ];

    // Insert the new grants
    for (const grant of newATTGrants) {
      await db.insert(grants).values(grant);
    }

    console.log("✅ Successfully added 5 new AT&T grants to database!");
    
    // Verify the grants were added
    const attGrants = await db.select().from(grants).where(eq(grants.companyId, 1));
    console.log(`📊 AT&T now has ${attGrants.length} total grants in the database`);
    
  } catch (error) {
    console.error("❌ Error adding AT&T grants:", error);
  }
}

addATTGrants();