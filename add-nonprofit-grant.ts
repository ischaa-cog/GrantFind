import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { companies, grants } from "./shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function addNonprofitGrant() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not found");
    process.exit(1);
  }

  const sql = postgres(connectionString);
  const db = drizzle(sql);

  try {
    // Check if company already exists
    const existingCompany = await db
      .select()
      .from(companies)
      .where(eq(companies.email, "grants@nonprofitguy.com"));

    let company;
    if (existingCompany.length === 0) {
      // Create new company
      const newCompany = await db
        .insert(companies)
        .values({
          name: "The Nonprofit Guy LLC",
          email: "grants@nonprofitguy.com",
          password: bcrypt.hashSync("company123", 10),
          description: "Supporting 501(c)(3) nonprofits with funding and strategic guidance"
        })
        .returning();
      
      company = newCompany[0];
      console.log("Created new company:", company.name);
    } else {
      company = existingCompany[0];
      console.log("Company already exists:", company.name);
    }

    // Check if grant already exists
    const existingGrant = await db
      .select()
      .from(grants)
      .where(eq(grants.title, "The Nonprofit Grant"));

    if (existingGrant.length === 0) {
      // Create new grant
      const newGrant = await db
        .insert(grants)
        .values({
          title: "The Nonprofit Grant",
          companyId: company.id,
          company: "The Nonprofit Guy LLC",
          amount: 1000,
          deadline: new Date("2025-08-18T23:59:59Z"),
          category: "Nonprofit",
          tags: ["$1k", "nonprofit", "501c3", "strategy"],
          description: "The Nonprofit Grant, created by The Nonprofit Guy, is a $1,000, no-strings-attached funding opportunity for one U.S.-based 501(c)(3) nonprofit ready to launch, grow, or sustain its mission. Along with the cash award, the winning organization receives a one-on-one strategy session with nonprofit coach Blake Nathan, plus proven grant templates and pitch strategies that have secured six-figure awards. Even if you don't win, you'll gain valuable clarity, actionable insights, and greater visibility within The Nonprofit Guy's network, positioning your nonprofit for future success. The application is quick and simple, making this both a financial boost and a strategic springboard for impact.",
          requirements: "Must be a U.S.-based 501(c)(3) nonprofit organization ready to launch, grow, or sustain its mission.",
          applicationUrl: "https://example.com/apply/nonprofit",
          status: "active",
          rating: 51,
          imageUrl: "https://images.unsplash.com/photo-1559027615-cd4628902d4a?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200",
          isNew: true
        })
        .returning();

      console.log("Created new grant:", newGrant[0].title);
    } else {
      console.log("Grant already exists:", existingGrant[0].title);
    }

    // Show final grants count
    const allGrants = await db.select().from(grants);
    console.log(`Total grants in database: ${allGrants.length}`);
    
    allGrants.forEach(grant => {
      console.log(`- ID: ${grant.id}, Title: ${grant.title}, Company: ${grant.company}`);
    });

  } catch (error) {
    console.error("Error adding nonprofit grant:", error);
  } finally {
    await sql.end();
  }
}

addNonprofitGrant();