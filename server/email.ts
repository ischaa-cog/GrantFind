// Resend Email Service Integration
import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return {apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email};
}

async function getUncachableResendClient() {
  const credentials = await getCredentials();
  return {
    client: new Resend(credentials.apiKey),
    fromEmail: connectionSettings.settings.from_email
  };
}

// Use verified domain email, fallback to Resend sandbox for testing
const VERIFIED_SENDER = 'GrantFind <info@circleofgreatness.com>';
const SANDBOX_SENDER = 'GrantFind <onboarding@resend.dev>';

// Set to true once domain is verified in Resend
// Change this to true after verifying circleofgreatness.com at https://resend.com/domains
const USE_VERIFIED_DOMAIN = false;

function getSenderEmail(): string {
  return USE_VERIFIED_DOMAIN ? VERIFIED_SENDER : SANDBOX_SENDER;
}

export async function sendTestEmail(toEmail: string): Promise<{ success: boolean; error?: string }> {
  console.log(`Sending test email to: ${toEmail}`);
  try {
    const { client } = await getUncachableResendClient();
    const senderEmail = getSenderEmail();
    
    const { data, error } = await client.emails.send({
      from: senderEmail,
      to: toEmail,
      subject: 'GrantFind - Test Email',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #f59e0b;">GrantFind Test Email</h1>
          <p>This is a test email to verify the email service is working correctly.</p>
          <p>If you received this email, the Resend integration is working!</p>
          <p style="color: #666; margin-top: 30px;">Sent at: ${new Date().toISOString()}</p>
        </div>
      `,
    });

    if (error) {
      console.error('Test email error:', JSON.stringify(error, null, 2));
      return { success: false, error: error.message };
    }

    console.log('✅ Test email sent successfully, ID:', data?.id);
    return { success: true };
  } catch (error: any) {
    console.error('Failed to send test email:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

export async function sendRegistrationConfirmationEmail(
  userEmail: string,
  firstName: string,
  lastName: string
): Promise<boolean> {
  console.log(`Attempting to send registration email to: ${userEmail}`);
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    console.log('Resend client initialized successfully');
    
    const senderEmail = getSenderEmail();
    
    const { error } = await client.emails.send({
      from: senderEmail,
      to: userEmail,
      subject: 'Welcome to GrantFind - Registration Confirmed!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to GrantFind!</h1>
          </div>
          
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 18px; margin-bottom: 20px;">Hi ${firstName} ${lastName},</p>
            
            <p style="margin-bottom: 20px;">Thank you for registering with <strong>GrantFind</strong>! Your account has been successfully created.</p>
            
            <p style="margin-bottom: 20px;">You now have access to:</p>
            
            <ul style="margin-bottom: 25px; padding-left: 20px;">
              <li style="margin-bottom: 10px;">Browse and discover grant opportunities</li>
              <li style="margin-bottom: 10px;">AI-powered Grant Finder to match you with relevant grants</li>
              <li style="margin-bottom: 10px;">Grant Application Reviewer to improve your submissions</li>
              <li style="margin-bottom: 10px;">Grant Proposal Writer to help craft winning proposals</li>
              <li style="margin-bottom: 10px;">Track your application statuses</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://grantfind.io/" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Go to Dashboard</a>
            </div>
            
            <p style="margin-bottom: 10px;">If you have any questions, feel free to reach out to our support team.</p>
            
            <p style="margin-top: 30px; color: #666;">Best regards,<br><strong>The GrantFind Team</strong></p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
            <p>&copy; ${new Date().getFullYear()} GrantFind. All rights reserved.</p>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('Resend email error:', JSON.stringify(error, null, 2));
      return false;
    }

    console.log(`✅ Registration confirmation email sent successfully to ${userEmail}`);
    return true;
  } catch (error) {
    console.error('Failed to send registration email:', error);
    return false;
  }
}

export async function sendTrialStartedEmail(
  userEmail: string,
  firstName: string,
  trialEndDate: Date,
  billingPeriod: "monthly" | "annual",
): Promise<boolean> {
  try {
    const { client } = await getUncachableResendClient();
    const formattedEndDate = trialEndDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const price = billingPeriod === "annual" ? "$270 per year" : "$27 per month";
    const { error } = await client.emails.send({
      from: getSenderEmail(),
      to: userEmail,
      subject: "Your 30-day GrantFind Pro trial has started",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #d97706;">Welcome to GrantFind Pro</h1>
          <p>Hi ${firstName},</p>
          <p>Your 30-day GrantFind Pro trial is active. You now have access to all Premium features.</p>
          <p>Your trial ends on <strong>${formattedEndDate}</strong>. Unless you cancel before then, your saved card will be charged <strong>${price}</strong> and your subscription will continue.</p>
          <p>You can view or cancel your trial from your GrantFind account settings. If you cancel, your Premium access will continue through ${formattedEndDate} and you will not be charged.</p>
          <p>– The GrantFind Team</p>
        </div>
      `,
    });
    if (error) {
      console.error("Trial-start email error:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Failed to send trial-start email:", error);
    return false;
  }
}

export async function sendTrialEndingSoonEmail(
  userEmail: string,
  firstName: string,
  trialEndDate: Date,
  billingPeriod: "monthly" | "annual",
): Promise<boolean> {
  try {
    const { client } = await getUncachableResendClient();
    const formattedEndDate = trialEndDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const price = billingPeriod === "annual" ? "$270 per year" : "$27 per month";
    const { error } = await client.emails.send({
      from: getSenderEmail(),
      to: userEmail,
      subject: "Your GrantFind Pro trial is ending soon",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #d97706;">Your trial ends soon</h1>
          <p>Hi ${firstName},</p>
          <p>Your GrantFind Pro trial ends on <strong>${formattedEndDate}</strong>.</p>
          <p>Unless you cancel before then, your saved card will be charged <strong>${price}</strong> and your subscription will continue automatically.</p>
          <p>If you cancel during the trial, you will keep Premium access through ${formattedEndDate} and will not be charged.</p>
          <p>– The GrantFind Team</p>
        </div>
      `,
    });
    if (error) {
      console.error("Trial-ending email error:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Failed to send trial-ending email:", error);
    return false;
  }
}
