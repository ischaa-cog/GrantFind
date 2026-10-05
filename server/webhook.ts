import { User, UserBusiness, Grant, UserGrantApplication } from "@shared/schema";

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: {
    user: {
      id: number;
      email: string;
      firstName: string;
      lastName: string;
    };
    business?: {
      id: number;
      name: string;
      category: string;
      subcategory?: string;
      businessType: string;
      entityType?: string;
      yearEstablished?: string;
      zipCode?: string;
      website?: string;
      revenue?: string;
      interests: string[];
    };
    grant?: {
      id: number;
      title: string;
      company: string;
      amount: string;
      deadline: string;
      category: string;
    };
    application?: {
      id: number;
      status: string;
      submittedAt: string;
      answers: any;
    };
  };
}

export async function sendUserRegistrationWebhook(user: User, getWebhookConfig?: (event: string) => any): Promise<void> {
  let webhookUrl = process.env.USER_REGISTRATION_WEBHOOK_URL || "https://hooks.zapier.com/hooks/catch/1866149/u4tr5pf/";
  
  // Try to get URL from admin panel configuration if available
  if (getWebhookConfig) {
    const config = getWebhookConfig("user.registered");
    if (config && config.active && config.url) {
      webhookUrl = config.url;
    }
  }
  
  if (!webhookUrl) {
    console.log("No webhook URL configured for user registration");
    return;
  }

  const payload = {
    event: "user.registered",
    timestamp: new Date().toISOString(),
    user_id: user.id,
    email: user.email,
    first_name: user.firstName,
    last_name: user.lastName,
    phone: user.phone || ""
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'GrantFind/1.0',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`Webhook failed with status ${response.status}: ${response.statusText}`);
      const errorText = await response.text();
      console.error('Webhook error response:', errorText);
    } else {
      console.log(`User registration webhook sent successfully for user: ${user.email}`);
    }
  } catch (error) {
    console.error('Error sending user registration webhook:', error);
  }
}

export async function sendBusinessCreatedWebhook(user: User, business: UserBusiness, getWebhookConfig?: (event: string) => any): Promise<void> {
  let webhookUrl = process.env.BUSINESS_CREATED_WEBHOOK_URL || "https://hooks.zapier.com/hooks/catch/1866149/u4tr5pf/";
  
  // Try to get URL from admin panel configuration if available
  if (getWebhookConfig) {
    const config = getWebhookConfig("business.created");
    if (config && config.active && config.url) {
      webhookUrl = config.url;
    }
  }
  
  if (!webhookUrl) {
    console.log("No webhook URL configured for business creation");
    return;
  }

  const payload = {
    event: "business.created",
    timestamp: new Date().toISOString(),
    user_id: user.id,
    email: user.email,
    first_name: user.firstName,
    last_name: user.lastName,
    business_id: business.id,
    business_name: business.name || "",
    business_category: business.category || "",
    business_subcategory: business.subcategory || "",
    business_type: business.businessType || "",
    entity_type: business.entityType || "",
    year_established: business.yearEstablished || "",
    zip_code: business.zipCode || "",
    website: business.website || "",
    revenue: business.revenue || "",
    interests: Array.isArray(business.interests) ? business.interests.join(", ") : ""
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'GrantFind/1.0',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`Business webhook failed with status ${response.status}: ${response.statusText}`);
      const errorText = await response.text();
      console.error('Business webhook error response:', errorText);
    } else {
      console.log(`Business creation webhook sent successfully for business: ${business.name} (User: ${user.email})`);
    }
  } catch (error) {
    console.error('Error sending business creation webhook:', error);
  }
}



export async function sendApplicationSubmittedWebhook(
  user: User, 
  business: UserBusiness | null, 
  grant: Grant, 
  application: UserGrantApplication,
  getWebhookConfig?: (event: string) => any
): Promise<void> {
  let webhookUrl = process.env.APPLICATION_SUBMITTED_WEBHOOK_URL || "https://hooks.zapier.com/hooks/catch/1866149/u4tr5pf/";
  
  // Try to get URL from admin panel configuration if available
  if (getWebhookConfig) {
    const config = getWebhookConfig("application.submitted");
    if (config && config.active && config.url) {
      webhookUrl = config.url;
    }
  }
  
  if (!webhookUrl) {
    console.log("No webhook URL configured for application submission");
    return;
  }

  const applicationAnswers = JSON.parse(application.answers || "{}");
  console.log("Application answers being sent to webhook:", applicationAnswers);
  
  const payload = {
    event: "application.submitted",
    timestamp: new Date().toISOString(),
    user_id: user.id,
    email: user.email,
    first_name: user.firstName,
    last_name: user.lastName,
    business_id: business?.id || "",
    business_name: business?.name || "",
    business_category: business?.category || "",
    business_subcategory: business?.subcategory || "",
    business_type: business?.businessType || "",
    entity_type: business?.entityType || "",
    year_established: business?.yearEstablished || "",
    zip_code: business?.zipCode || "",
    website: business?.website || "",
    revenue: business?.revenue || "",
    interests: Array.isArray(business?.interests) ? business.interests.join(", ") : "",
    grant_id: grant.id,
    grant_title: grant.title,
    grant_company: grant.company,
    grant_amount: grant.amount.toString(),
    grant_deadline: grant.deadline.toISOString(),
    grant_category: grant.category,
    application_id: application.id,
    application_status: application.status,
    submitted_at: application.updatedAt?.toISOString() || new Date().toISOString(),
    ...applicationAnswers
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'GrantFind/1.0',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`Application webhook failed with status ${response.status}: ${response.statusText}`);
      const errorText = await response.text();
      console.error('Application webhook error response:', errorText);
    } else {
      console.log(`Application submission webhook sent successfully for grant: ${grant.title} (User: ${user.email})`);
    }
  } catch (error) {
    console.error('Error sending application submission webhook:', error);
  }
}

export async function sendTestWebhook(webhookUrl: string, eventType: string = "user.registered"): Promise<{ success: boolean; message: string }> {
  // Create sample data based on event type using the flattened format
  let testPayload: any;
  
  switch (eventType) {
    case "user.registered":
      testPayload = {
        event: "user.registered",
        timestamp: new Date().toISOString(),
        user_id: 123,
        email: "john.doe@example.com",
        first_name: "John",
        last_name: "Doe",
        phone: "+1-555-0123"
      };
      break;
      
    case "business.created":
      testPayload = {
        event: "business.created",
        timestamp: new Date().toISOString(),
        user_id: 123,
        email: "john.doe@example.com",
        first_name: "John",
        last_name: "Doe",
        business_id: 456,
        business_name: "Acme Technologies",
        business_category: "Technology",
        business_subcategory: "Software Development",
        business_type: "existing",
        entity_type: "LLC",
        year_established: "2020",
        zip_code: "90210",
        website: "https://acme-tech.com",
        revenue: "500000",
        interests: "grants, funding, technology"
      };
      break;
      
    case "application.submitted":
      testPayload = {
        event: "application.submitted",
        timestamp: new Date().toISOString(),
        user_id: 123,
        email: "john.doe@example.com",
        first_name: "John",
        last_name: "Doe",
        business_id: 456,
        business_name: "Acme Technologies",
        business_category: "Technology",
        business_subcategory: "Software Development",
        business_type: "existing",
        entity_type: "LLC",
        year_established: "2020",
        zip_code: "90210",
        website: "https://acme-tech.com",
        revenue: "500000",
        interests: "grants, funding, technology",
        grant_id: 101,
        grant_title: "Innovation Grant 2025",
        grant_company: "Tech Innovations Inc",
        grant_amount: "100000",
        grant_deadline: "2025-12-31T23:59:59Z",
        grant_category: "Technology",
        application_id: 789,
        application_status: "Applied",
        submitted_at: new Date().toISOString(),
        // Current application form questions/answers
        fullName: "John Doe",
        phone: "+1555123456", 
        igHandle: "@johndoe_tech",
        businessEstablished: "2020",
        currentCity: "Los Angeles",
        businessDescription: "business-owner-1-10",
        businessIndustry: "technology",
        monthlyRevenue: "10k-25k",
        grantPurpose: "I will use this grant to expand my AI-powered business platform to serve more small businesses in our community. The funding will help us hire additional developers and enhance our product features.",
        howHeard: "online-ads"
      };
      break;
      
    default:
      testPayload = {
        event: "test",
        timestamp: new Date().toISOString(),
        test_message: "This is a test webhook from GrantFind Admin Panel",
        source: "GrantFind Admin Panel"
      };
  }

  try {
    // Log the test payload to see what's actually being sent
    console.log('Webhook test payload being sent:', JSON.stringify(testPayload, null, 2));
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'GrantFind/1.0',
      },
      body: JSON.stringify(testPayload),
    });

    if (!response.ok) {
      return {
        success: false,
        message: `Webhook failed with status ${response.status}: ${response.statusText}`
      };
    }

    return {
      success: true,
      message: `Webhook test successful! Status: ${response.status}`
    };
  } catch (error) {
    return {
      success: false,
      message: `Webhook test failed: ${error}`
    };
  }
}