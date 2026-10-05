const { jsPDF } = require('jspdf');
const path = require('path');

const pdfPath = path.resolve(__dirname, '../docs/GrantFind-User-Guide.pdf');

const doc = new jsPDF({
  orientation: 'portrait',
  unit: 'in',
  format: 'letter'
});

const pageWidth = 8.5;
const pageHeight = 11;
const margin = 0.75;
const contentWidth = pageWidth - (margin * 2);
let yPos = margin;

const colors = {
  gold: [245, 166, 35],
  black: [0, 0, 0],
  gray: [100, 100, 100],
  darkGray: [50, 50, 50]
};

function addPage() {
  doc.addPage();
  yPos = margin;
}

function checkPageBreak(height = 0.5) {
  if (yPos + height > pageHeight - margin) {
    addPage();
    return true;
  }
  return false;
}

function addHeading(text, level = 2) {
  const sizes = { 1: 20, 2: 16, 3: 13, 4: 11 };
  checkPageBreak(0.6);
  yPos += 0.1;
  doc.setFontSize(sizes[level] || 14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...colors.darkGray);
  doc.text(text, margin, yPos);
  if (level <= 2) {
    yPos += 0.08;
    doc.setDrawColor(...colors.gold);
    doc.setLineWidth(0.02);
    doc.line(margin, yPos, margin + contentWidth * 0.35, yPos);
  }
  yPos += 0.25;
}

function addParagraph(text) {
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...colors.black);
  const lines = doc.splitTextToSize(text, contentWidth);
  for (const line of lines) {
    checkPageBreak(0.18);
    doc.text(line, margin, yPos);
    yPos += 0.18;
  }
  yPos += 0.08;
}

function addBullet(text, indent = 0) {
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...colors.black);
  const bulletX = margin + (indent * 0.2);
  const textX = bulletX + 0.15;
  const lines = doc.splitTextToSize(text, contentWidth - 0.15 - (indent * 0.2));
  checkPageBreak(0.18);
  doc.text('•', bulletX, yPos);
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) checkPageBreak(0.18);
    doc.text(lines[i], textX, yPos);
    yPos += 0.18;
  }
}

function addNumbered(num, text) {
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...colors.black);
  const lines = doc.splitTextToSize(text, contentWidth - 0.25);
  checkPageBreak(0.18);
  doc.text(num + '.', margin, yPos);
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) checkPageBreak(0.18);
    doc.text(lines[i], margin + 0.25, yPos);
    yPos += 0.18;
  }
}

function addTableRow(cols, isHeader = false) {
  checkPageBreak(0.3);
  const colWidth = contentWidth / cols.length;
  doc.setFontSize(9);
  doc.setFont('helvetica', isHeader ? 'bold' : 'normal');
  if (isHeader) {
    doc.setFillColor(...colors.gold);
    doc.rect(margin, yPos - 0.12, contentWidth, 0.25, 'F');
    doc.setTextColor(255, 255, 255);
  } else {
    doc.setTextColor(...colors.black);
  }
  cols.forEach((col, i) => {
    const text = doc.splitTextToSize(col, colWidth - 0.1)[0] || '';
    doc.text(text, margin + (i * colWidth) + 0.05, yPos);
  });
  yPos += 0.22;
}

function addTip(text) {
  checkPageBreak(0.4);
  doc.setFillColor(255, 249, 230);
  doc.setDrawColor(...colors.gold);
  doc.rect(margin, yPos - 0.1, contentWidth, 0.35, 'FD');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...colors.gold);
  doc.text('TIP:', margin + 0.1, yPos + 0.05);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...colors.black);
  const tipText = doc.splitTextToSize(text, contentWidth - 0.5)[0];
  doc.text(tipText, margin + 0.4, yPos + 0.05);
  yPos += 0.35;
}

// TITLE PAGE
yPos = 3.5;
doc.setFontSize(32);
doc.setFont('helvetica', 'bold');
doc.setTextColor(...colors.black);
doc.text('GrantFind App', pageWidth / 2, yPos, { align: 'center' });
yPos += 0.5;
doc.setFontSize(22);
doc.setTextColor(...colors.gold);
doc.text('End User Guide', pageWidth / 2, yPos, { align: 'center' });
yPos += 0.3;
doc.setDrawColor(...colors.gold);
doc.setLineWidth(0.03);
doc.line(pageWidth / 2 - 1, yPos, pageWidth / 2 + 1, yPos);
yPos += 0.6;
doc.setFontSize(12);
doc.setFont('helvetica', 'normal');
doc.setTextColor(...colors.gray);
doc.text('Your complete guide to finding and winning grants', pageWidth / 2, yPos, { align: 'center' });
yPos += 0.3;
doc.text('https://grantfind.io', pageWidth / 2, yPos, { align: 'center' });
yPos += 1.0;
doc.text('Version: 1.0', pageWidth / 2, yPos, { align: 'center' });
yPos += 0.2;
doc.text('Date: January 18, 2026', pageWidth / 2, yPos, { align: 'center' });

// TOC
addPage();
addHeading('Table of Contents', 1);
const tocItems = [
  '1. Overview',
  '2. Who This App Is For',
  '3. What You Need Before Using GrantFind',
  '4. How to Log In / Sign Up',
  '5. Setting Up Your Profile',
  '6. How to Search for Grants',
  '7. How to Filter & Sort Results',
  '8. How to Open and Read a Grant',
  '9. How to Save/Bookmark Grants',
  '10. How to Track Deadlines',
  '11. How to Export or Share',
  '12. AI Grant Finder - Complete Guide',
  '13. Application Reviewer - Complete Guide',
  '14. Proposal Writer - Complete Guide',
  '15. Best Practices',
  '16. Troubleshooting',
  '17. FAQ',
  '18. Glossary of Grant Terms',
  '19. Support'
];
tocItems.forEach(item => {
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...colors.black);
  doc.text(item, margin + 0.2, yPos);
  yPos += 0.28;
});

// SECTION 1: OVERVIEW
addPage();
addHeading('1. Overview', 1);
addHeading('What is GrantFind?', 3);
addParagraph('GrantFind is an easy-to-use platform that helps you discover, apply for, and manage grant opportunities for your business. Whether you are a startup founder, small business owner, or nonprofit leader, GrantFind connects you with funding opportunities that match your needs.');
addHeading('Key Features', 3);
addBullet('Grant Vault - Browse a curated collection of verified grant opportunities');
addBullet('AI Grant Finder - Answer questions and get personalized grant recommendations');
addBullet('Application Reviewer - Get AI-powered feedback on your applications');
addBullet('Proposal Writer - Step-by-step AI assistance for grant proposals');
addBullet('Business Dashboard - Track all your applications and deadlines');
addHeading('How GrantFind Helps You', 3);
addTableRow(['Challenge', 'How GrantFind Helps'], true);
addTableRow(['Don\'t know which grants I qualify for', 'AI Grant Finder matches you with relevant opportunities']);
addTableRow(['Writing proposals takes too long', 'Proposal Writer guides you section by section']);
addTableRow(['Not sure if application is strong enough', 'Application Reviewer scores and improves drafts']);
addTableRow(['Lose track of deadlines', 'Dashboard tracks applications and due dates']);

// SECTION 2: WHO THIS APP IS FOR
addPage();
addHeading('2. Who This App Is For', 1);
addHeading('Small Business Owners', 3);
addParagraph('If you run a small business and are looking for non-dilutive funding, GrantFind can help you find grants specifically for your industry and business type.');
addHeading('Startup Founders', 3);
addParagraph('Early-stage companies often need capital to grow. GrantFind helps you discover grants for innovation, technology, and new ventures.');
addHeading('Women-Owned Businesses', 3);
addParagraph('Many grants specifically support women entrepreneurs. GrantFind includes a dedicated category of grants for women-owned businesses.');
addHeading('Minority-Owned Businesses', 3);
addParagraph('GrantFind features grants designed to support minority entrepreneurs and underrepresented founders.');
addHeading('Veteran-Owned Businesses', 3);
addParagraph('Veterans transitioning to entrepreneurship can find specialized grants and funding programs through GrantFind.');
addHeading('Nonprofit Organizations', 3);
addParagraph('Organizations with a social mission can discover foundation grants and government funding opportunities.');

// SECTION 3: WHAT YOU NEED
addPage();
addHeading('3. What You Need Before Using GrantFind', 1);
addHeading('Required Information', 3);
addTableRow(['Item', 'Why You Need It'], true);
addTableRow(['Business Name', 'To set up your profile and track applications']);
addTableRow(['Business Type', 'Helps match you with relevant grants']);
addTableRow(['Industry/Sector', 'Many grants are industry-specific']);
addTableRow(['Year Founded', 'Some grants have age requirements']);
addTableRow(['Location', 'State/city for geographic-specific grants']);
addTableRow(['Email Address', 'For account creation and notifications']);
addHeading('Helpful to Have Ready', 3);
addBullet('Business Description - A 2-3 sentence summary of what your business does');
addBullet('Revenue Information - Annual revenue (even if $0 for startups)');
addBullet('Employee Count - Number of team members');
addBullet('Business Certifications - Woman-owned, minority-owned, veteran-owned, etc.');

// SECTION 4: LOGIN
addPage();
addHeading('4. How to Log In / Sign Up', 1);
addHeading('Creating a New Account', 3);
addNumbered(1, 'Go to https://grantfind.io');
addNumbered(2, 'Click the Sign Up button in the top right corner');
addNumbered(3, 'Enter your Full Name, Email Address, and Password (at least 8 characters)');
addNumbered(4, 'Click Create Account');
addNumbered(5, 'Check your email for a confirmation message');
addNumbered(6, 'Click the confirmation link to verify your account');
addHeading('Logging In', 3);
addNumbered(1, 'Go to https://grantfind.io/signin');
addNumbered(2, 'Enter your email address and password');
addNumbered(3, 'Click Log In');
addHeading('Forgot Your Password?', 3);
addNumbered(1, 'On the login page, click Forgot Password');
addNumbered(2, 'Enter your email address');
addNumbered(3, 'Click Send Reset Link and check your email');

// SECTION 5: PROFILE SETUP
addPage();
addHeading('5. Setting Up Your Profile', 1);
addHeading('Step 1: Add Your First Business', 3);
addNumbered(1, 'After logging in, you\'ll see the Add Business prompt');
addNumbered(2, 'Click Add Business or the + button');
addNumbered(3, 'Fill in: Business Name, Industry, Business Type, Year Founded, Location, Description');
addNumbered(4, 'Click Save Business');
addHeading('Step 2: Add Business Certifications (Optional)', 3);
addParagraph('If your business has special certifications, add them to see more relevant grants:');
addBullet('Woman-Owned Business');
addBullet('Minority-Owned Business');
addBullet('Veteran-Owned Business');
addBullet('Disabled Veteran-Owned');

// SECTIONS 6-11 (Quick versions)
addPage();
addHeading('6. How to Search for Grants', 1);
addParagraph('GrantFind offers two ways to find grants: browsing the Grants Vault or using the AI Grant Finder.');
addHeading('Method 1: Browse the Grants Vault', 3);
addNumbered(1, 'Click Grants Vault in the navigation menu');
addNumbered(2, 'Browse the list of available grants');
addNumbered(3, 'Each grant card shows: Grant name, Funding organization, Award amount, Deadline');
addHeading('Method 2: Use the AI Grant Finder', 3);
addParagraph('See Section 12 for complete AI Grant Finder instructions.');

addHeading('7. How to Filter & Sort Results', 2);
addBullet('Category - Women-owned, Minority-owned, Veteran-owned, General, Federal');
addBullet('Award Amount - Minimum and maximum funding amounts');
addBullet('Deadline - Show only grants with upcoming deadlines');
addBullet('Sort by: Deadline, Award Amount, Recently Added, Rating');

addHeading('8. How to Open and Read a Grant', 2);
addParagraph('Click on any grant card to view: Overview, Award Amount, Eligibility, Deadline, Requirements, How to Apply, and Official Link.');

addHeading('9. How to Save/Bookmark Grants', 2);
addParagraph('Click the Save or Bookmark icon on any grant to save it. View saved grants in your Dashboard.');

addHeading('10. How to Track Deadlines', 2);
addParagraph('Your Dashboard shows all applications with status: Not Started, In Progress, Submitted, Under Review, Approved, or Rejected.');

addHeading('11. How to Export or Share', 2);
addParagraph('Use your browser\'s print function (Ctrl+P) and select "Save as PDF" to export grant details.');

// SECTION 12: AI GRANT FINDER - DETAILED
addPage();
addHeading('12. AI Grant Finder - Complete Guide', 1);
addParagraph('The AI Grant Finder is a powerful 9-question questionnaire that uses artificial intelligence to match you with the 10 most relevant grants from our database of 30+ verified grant programs.');

addHeading('How It Works', 3);
addParagraph('You answer 9 questions about your business. The AI analyzes your responses and compares them against our curated database to find grants that match your eligibility criteria, industry, location, and funding needs.');

addHeading('Step-by-Step Instructions', 3);
addNumbered(1, 'Click Grant Finder in the navigation menu');
addNumbered(2, 'Click Start Finding Grants to begin the questionnaire');
addNumbered(3, 'Answer all 9 questions honestly and completely');
addNumbered(4, 'Click Find My Grants after the final question');
addNumbered(5, 'Review your personalized list of 10 matched grants');
addNumbered(6, 'Click any grant to view details and apply');

addHeading('The 9 Questions Explained', 3);

addHeading('Question 1: Business Type', 4);
addParagraph('Select what type of business or organization you represent:');
addBullet('Nonprofit Organization');
addBullet('Small Business (1-50 employees)');
addBullet('Medium Business (51-250 employees)');
addBullet('Large Business (250+ employees)');
addBullet('Startup');
addBullet('Social Enterprise');
addBullet('Educational Institution');
addBullet('Research Organization');

addPage();
addHeading('Question 2: Project Goals', 4);
addParagraph('Describe your project goals in your own words. Be specific about what you want to accomplish with the grant funding. Examples:');
addBullet('"Expand our manufacturing capacity to meet growing demand"');
addBullet('"Launch a job training program for underserved youth"');
addBullet('"Develop a new technology product for the healthcare industry"');
addTip('The more specific you are, the better the AI can match you with relevant grants.');

addHeading('Question 3: Location & Geographic Scope', 4);
addParagraph('Enter your business location (city/state) and select your geographic preference:');
addBullet('Local - Grants specific to your city, county, or region');
addBullet('State - Grants available in your state');
addBullet('National - Grants available across the United States');
addBullet('International - Global grant opportunities');

addHeading('Question 4: Industry', 4);
addParagraph('Select the industry that best describes your business:');
addBullet('Healthcare & Medical');
addBullet('Technology & Software');
addBullet('Education & Training');
addBullet('Agriculture & Food');
addBullet('Manufacturing');
addBullet('Clean Energy & Environment');
addBullet('Arts & Culture');
addBullet('Community Development');
addBullet('Social Services');
addBullet('Scientific Research');
addBullet('Construction & Real Estate');
addBullet('Retail & E-commerce');
addBullet('Transportation & Logistics');

addPage();
addHeading('Question 5: Funding Need', 4);
addParagraph('Select the approximate amount of funding you need:');
addBullet('Under $10,000 - Micro-grants, often easier to win');
addBullet('$10,000 - $50,000 - Small grants, moderate competition');
addBullet('$50,000 - $100,000 - Medium grants, competitive');
addBullet('$100,000 - $500,000 - Large grants, highly competitive');
addBullet('$500,000 - $1,000,000 - Major grants, very selective');
addBullet('Over $1,000,000 - Enterprise-level grants');
addTip('Start with smaller grants if you\'re new to grant applications. They have simpler requirements and less competition.');

addHeading('Question 6: Ownership Type', 4);
addParagraph('Check all that apply to your business ownership:');
addBullet('Minority-owned - At least 51% owned by minority individuals');
addBullet('Women-owned - At least 51% owned by women');
addBullet('Veteran-owned - At least 51% owned by military veterans');
addBullet('Disabled-owned - At least 51% owned by individuals with disabilities');
addBullet('None of the above');
addParagraph('Many grants specifically target these ownership types, so accurate selection improves your matches.');

addHeading('Question 7: Grant Experience', 4);
addParagraph('Have you applied for grants before?');
addBullet('Yes - The AI may suggest more complex grants with higher awards');
addBullet('No - The AI will prioritize grants with simpler application processes');
addParagraph('First-time applicants receive grants that are easier to apply for and have higher acceptance rates.');

addPage();
addHeading('Question 8: Grant Type Preference', 4);
addParagraph('What type of grants do you prefer?');
addBullet('Federal Grants - From U.S. government agencies (SBA, USDA, etc.)');
addBullet('Corporate Grants - From companies like Google, FedEx, Visa');
addBullet('Foundation Grants - From private foundations (Amber Grant, Halstead, etc.)');
addBullet('No Preference - Show all matching grants regardless of type');

addHeading('Question 9: Date Confirmation', 4);
addParagraph('Confirm today\'s date. This ensures the AI only shows grants with current or upcoming deadlines, filtering out expired opportunities.');

addHeading('Understanding Your Results', 3);
addParagraph('After answering all 9 questions, the AI returns your top 10 matched grants. Each result includes:');
addBullet('Grant Title - Name of the grant program');
addBullet('Description - What the grant funds');
addBullet('Eligibility - Who can apply');
addBullet('Deadline - When applications are due');
addBullet('Amount - How much funding is available');
addBullet('Official Link - Direct link to apply');
addTip('Save grants you\'re interested in to your Dashboard so you don\'t lose them!');

// SECTION 13: APPLICATION REVIEWER - DETAILED
addPage();
addHeading('13. Application Reviewer - Complete Guide', 1);
addParagraph('The Application Reviewer is an AI-powered tool that analyzes your grant application before you submit it. It scores your application across 7 professional criteria, identifies strengths, and provides specific recommendations for improvement.');

addHeading('How It Works', 3);
addParagraph('You provide the grant requirements and your draft application. The AI compares your application against the requirements and professional grant-writing standards, then generates a detailed evaluation with scores and recommendations.');

addHeading('Step-by-Step Instructions', 3);
addNumbered(1, 'Click Application Reviewer in the navigation menu');
addNumbered(2, 'Complete the 5-step review process');
addNumbered(3, 'Review your scores and feedback');
addNumbered(4, 'Make improvements based on recommendations');
addNumbered(5, 'Re-submit for another review if needed');

addHeading('The 5 Review Steps', 3);

addHeading('Step 1: Grant Requirements', 4);
addParagraph('Provide the grant requirements in one of two ways:');
addBullet('Paste the grant requirements text directly into the text box');
addBullet('Enter the URL of the grant program website');
addParagraph('The more complete the requirements, the more accurate the review.');

addHeading('Step 2: Application Upload', 4);
addParagraph('Upload your draft application:');
addBullet('Upload a PDF file - The system will extract the text automatically');
addBullet('Paste your application text directly into the text box');
addParagraph('Both methods work equally well. Use whichever is more convenient.');

addPage();
addHeading('Step 3: Analysis', 4);
addParagraph('The AI analyzes your application. This typically takes 30-60 seconds. During analysis, the AI:');
addBullet('Compares your application to the grant requirements');
addBullet('Evaluates grammar, clarity, and professionalism');
addBullet('Assesses alignment with the funder\'s goals');
addBullet('Checks for common grant application mistakes');

addHeading('Step 4: Scoring', 4);
addParagraph('View your scores across 7 professional criteria. Each criterion is scored from 1-5:');

addHeading('The 7 Scoring Criteria', 3);
addTableRow(['Criteria', 'What It Measures'], true);
addTableRow(['1. Alignment with Funder Goals', 'How well your project matches funder priorities']);
addTableRow(['2. Feasibility of the Project', 'Whether your project can realistically be completed']);
addTableRow(['3. Impact of the Project', 'The significance of your project\'s outcomes']);
addTableRow(['4. Innovation', 'How creative or novel your approach is']);
addTableRow(['5. Organizational Capacity', 'Your ability to execute the project']);
addTableRow(['6. Budget Feasibility', 'Whether your budget is realistic and justified']);
addTableRow(['7. Scalability & Sustainability', 'Long-term viability of your project']);

addParagraph('Maximum total score: 35 points (7 criteria x 5 points each)');

addHeading('Understanding Your Score', 4);
addBullet('30-35 points (86-100%): Excellent - Ready to submit');
addBullet('25-29 points (71-85%): Good - Minor improvements needed');
addBullet('20-24 points (57-70%): Fair - Several areas need work');
addBullet('Below 20 points (<57%): Needs significant revision');

addPage();
addHeading('Step 5: Recommendations', 4);
addParagraph('The AI provides detailed feedback including:');

addHeading('Strengths', 4);
addParagraph('A list of 3+ things your application does well. These are elements to keep and potentially emphasize more.');

addHeading('Areas for Improvement', 4);
addParagraph('A list of 3+ specific recommendations to strengthen your application. Each recommendation explains what to change and why.');

addHeading('Overall Feedback', 4);
addParagraph('A detailed written summary of your application\'s evaluation, including context for the scores and prioritized next steps.');

addHeading('Tips for Using the Application Reviewer', 3);
addBullet('Review your application BEFORE the deadline - Leave time for revisions');
addBullet('Address the lowest-scoring criteria first - Focus on the biggest improvements');
addBullet('Re-review after making changes - Confirm your score improves');
addBullet('Keep the recommendations - Reference them for future applications');
addTip('Many successful grant applicants review their application 2-3 times, making improvements each round.');

// SECTION 14: PROPOSAL WRITER - DETAILED
addPage();
addHeading('14. Proposal Writer - Complete Guide', 1);
addParagraph('The Proposal Writer is a comprehensive 6-step wizard that guides you through writing a complete grant proposal from scratch. The AI assists with each section, ensuring your proposal meets professional standards and addresses all funder requirements.');

addHeading('How It Works', 3);
addParagraph('You provide information about the grant and your project. The AI analyzes the requirements, creates an outline, and helps you draft each section. Finally, it checks compliance and compiles your final proposal.');

addHeading('The 6-Step Process', 3);

addHeading('Step 1: Grant Information', 4);
addParagraph('Provide the grant guidelines in one of two ways:');
addBullet('Enter the URL of the grant program website');
addBullet('Upload a PDF of the grant guidelines');
addBullet('Paste the grant requirements text directly');
addParagraph('The more detailed the information, the better the AI can tailor your proposal.');

addHeading('Step 2: Grant Analysis', 4);
addParagraph('The AI analyzes the grant requirements and identifies:');
addBullet('Grant Type - Government, foundation, corporate, or other');
addBullet('Formatting Standards - Page limits, font requirements, etc.');
addBullet('Key Requirements - What the funder is looking for');
addBullet('Funding Priorities - What the funder values most');
addBullet('Deadline - When the application is due');
addBullet('Word Count Limits - Maximum length for sections');

addPage();
addHeading('Step 3: Project Information', 4);
addParagraph('Provide details about your project by answering three questions:');

addHeading('Project Purpose', 4);
addParagraph('Describe what your project aims to accomplish. Example: "Our project will create a job training program that helps 200 unemployed adults in our community gain skills for careers in healthcare."');

addHeading('Target Community', 4);
addParagraph('Describe who will benefit from your project. Example: "Adults aged 25-55 in the greater Phoenix area who have been unemployed for 6+ months and have a high school diploma or GED."');

addHeading('Primary Goals', 4);
addParagraph('List 2-4 specific, measurable goals. Example: "1) Train 200 participants in certified nursing assistant skills, 2) Achieve 85% job placement rate within 90 days of graduation, 3) Maintain 90% participant completion rate."');

addHeading('Step 4: Write Sections', 4);
addParagraph('The AI helps you draft each section of your proposal. You can generate AI drafts and then edit them to match your voice. The 10 proposal sections are:');

addBullet('Cover Letter - Introduction to your organization and request');
addBullet('Executive Summary - One-page overview of your entire proposal');
addBullet('Statement of Need - Why this project is necessary');
addBullet('Project Description - Objectives, methods, and timeline');
addBullet('Budget - Detailed breakdown of costs');
addBullet('Impact Statement - Expected outcomes and significance');
addBullet('Evaluation Plan - How you\'ll measure success');
addBullet('Sustainability Plan - How the project continues after grant ends');
addBullet('Organizational Background - Your organization\'s qualifications');
addBullet('Appendices - Supporting documents and attachments');

addPage();
addHeading('How to Use Each Section', 4);
addParagraph('For each section:');
addNumbered(1, 'Click on the section name to select it');
addNumbered(2, 'Click Generate AI Draft to create initial content');
addNumbered(3, 'Review the AI-generated draft');
addNumbered(4, 'Edit the text to match your voice and add specific details');
addNumbered(5, 'Click Save Section when satisfied');
addNumbered(6, 'Repeat for all 10 sections');
addTip('Don\'t just accept the AI drafts as-is. Add your unique voice, specific data, and organizational details to make the proposal genuinely yours.');

addHeading('Step 5: Compliance Check', 4);
addParagraph('The AI reviews your complete proposal against the grant requirements to ensure compliance. It checks:');
addBullet('All required sections are included');
addBullet('Word/page limits are met');
addBullet('Key requirements are addressed');
addBullet('Formatting standards are followed');

addParagraph('Results are shown as:');
addBullet('Compliant (Green) - Section meets all requirements');
addBullet('Warning (Yellow) - Section may need attention');
addBullet('Error (Red) - Section has issues that must be fixed');

addHeading('Step 6: Final Review', 4);
addParagraph('Review your complete proposal in one document:');
addNumbered(1, 'Read through the compiled proposal');
addNumbered(2, 'Make any final edits');
addNumbered(3, 'Click Download as PDF to save your proposal');
addNumbered(4, 'Click Copy to Clipboard to paste into another document');

addPage();
addHeading('Proposal Writing Best Practices', 3);
addBullet('Start Early - Give yourself at least 2-3 weeks before the deadline');
addBullet('Be Specific - Use concrete numbers, dates, and measurable outcomes');
addBullet('Tell a Story - Connect emotionally with the funder through narrative');
addBullet('Show Alignment - Explicitly connect your project to funder priorities');
addBullet('Proofread Everything - Grammar and spelling errors hurt your credibility');
addBullet('Get Feedback - Have colleagues review before submitting');
addBullet('Follow Instructions - Address every requirement, even small ones');
addTip('The best proposals are clear, specific, and demonstrate a deep understanding of both the problem and the proposed solution.');

// SECTION 15: BEST PRACTICES
addPage();
addHeading('15. Best Practices', 1);
addHeading('How to Find Better Grants Faster', 3);
addBullet('1. Complete Your Profile Fully - Better matches with more information');
addBullet('2. Use the AI Grant Finder First - Let AI narrow to your best 10 matches');
addBullet('3. Apply to Grants You Actually Qualify For - Read eligibility carefully');
addBullet('4. Start with Smaller Grants - Under $25K often has less competition');
addBullet('5. Apply Early, Not Last Minute - Many review as applications come in');
addBullet('6. Use the Proposal Writer Tool - AI guides you through each section');
addBullet('7. Use Application Reviewer Before Submitting - Catch weak spots');
addBullet('8. Track Everything in Dashboard - Stay organized, never miss deadlines');
addBullet('9. Reuse and Adapt - Strong proposals can be adapted for similar grants');
addBullet('10. Apply to Multiple Grants - 5-10 applications increases your odds');

// SECTION 16: TROUBLESHOOTING
addPage();
addHeading('16. Troubleshooting', 1);
addTableRow(['Problem', 'Solution'], true);
addTableRow(['Can\'t log in', 'Check email, use Forgot Password, check Caps Lock, clear cache']);
addTableRow(['Not receiving emails', 'Check spam folder, add to contacts, wait 5-10 minutes']);
addTableRow(['Page won\'t load', 'Refresh page, try different browser, check internet']);
addTableRow(['Can\'t find grants for industry', 'Use AI Grant Finder, check General category']);
addTableRow(['Saved grants disappeared', 'Check correct account, grants may be archived']);
addTableRow(['Apply button doesn\'t work', 'Check pop-up blocker, right-click Open in New Tab']);
addTableRow(['AI tools not responding', 'Wait 30 seconds and try again']);
addTableRow(['PDF upload fails', 'Try pasting text directly instead']);
addTableRow(['Grant Finder no results', 'Answer all questions, try broader answers']);
addTableRow(['Proposal Writer stuck', 'Refresh page, your progress is saved']);

// SECTION 17: FAQ
addPage();
addHeading('17. FAQ', 1);
addHeading('General Questions', 3);
addParagraph('Q: Is GrantFind free to use?');
addParagraph('A: Basic grant browsing is free. Premium AI tools may require a subscription.');
addParagraph('Q: Does GrantFind guarantee I\'ll win a grant?');
addParagraph('A: No. Winning depends on your business, competition, and application quality.');
addHeading('AI Tools Questions', 3);
addParagraph('Q: How does AI Grant Finder work?');
addParagraph('A: Answer 9 questions, AI matches you with 10 most relevant grants from 30+ verified programs.');
addParagraph('Q: How does Application Reviewer work?');
addParagraph('A: Paste your application text, AI scores it across 7 criteria (max 35 points) with specific feedback.');
addParagraph('Q: How does Proposal Writer work?');
addParagraph('A: 6-step wizard guides you through writing all 10 sections of a complete grant proposal.');
addParagraph('Q: Are the grants in the database real?');
addParagraph('A: Yes. All 30+ grants are verified from legitimate organizations with official application links.');

// SECTION 18: GLOSSARY
addPage();
addHeading('18. Glossary of Grant Terms', 1);
addTableRow(['Term', 'Definition'], true);
addTableRow(['Award Amount', 'Total funding available through the grant']);
addTableRow(['Deadline', 'Final date for application submission']);
addTableRow(['Eligibility', 'Requirements to apply for a grant']);
addTableRow(['Foundation Grant', 'Funding from private foundations']);
addTableRow(['Federal Grant', 'Funding from U.S. government agencies']);
addTableRow(['Grant', 'Money that doesn\'t need to be paid back']);
addTableRow(['Grant Proposal', 'Document explaining your project']);
addTableRow(['Letter of Intent', 'Brief letter before full application']);
addTableRow(['Matching Funds', 'Your contribution requirement']);
addTableRow(['Non-Dilutive Funding', 'Money without giving up equity']);
addTableRow(['RFP', 'Request for Proposal announcement']);
addTableRow(['SBA', 'Small Business Administration']);
addTableRow(['Woman-Owned Business', '51%+ owned by women']);
addTableRow(['Minority-Owned Business', '51%+ owned by minorities']);
addTableRow(['Veteran-Owned Business', '51%+ owned by veterans']);

// SECTION 19: SUPPORT
addPage();
addHeading('19. Support', 1);
addHeading('Need Help?', 3);
addParagraph('If you have questions or run into issues, we\'re here to help!');
addParagraph('Website: https://grantfind.io');
addParagraph('Hours: Monday - Friday, 9:00 AM - 5:00 PM EST');
addHeading('Before Contacting Support', 3);
addBullet('Your account email address');
addBullet('Description of the issue');
addBullet('Screenshots (if applicable)');
addBullet('Device and browser you\'re using');
addHeading('Quick Links', 3);
addParagraph('Sign In: https://grantfind.io/signin');
addParagraph('Grant Vault: https://grantfind.io/grants-vault');
addParagraph('Grant Finder: https://grantfind.io/grant-finder');
addParagraph('Application Reviewer: https://grantfind.io/application-reviewer');
addParagraph('Proposal Writer: https://grantfind.io/proposal-writer');
yPos += 0.4;
doc.setDrawColor(...colors.gold);
doc.setLineWidth(0.02);
doc.line(margin, yPos, pageWidth - margin, yPos);
yPos += 0.35;
doc.setFontSize(13);
doc.setFont('helvetica', 'bold');
doc.setTextColor(...colors.black);
doc.text('Thank you for using GrantFind!', pageWidth / 2, yPos, { align: 'center' });
yPos += 0.25;
doc.setFontSize(10);
doc.setFont('helvetica', 'italic');
doc.setTextColor(...colors.gray);
doc.text('Helping entrepreneurs find the funding they deserve.', pageWidth / 2, yPos, { align: 'center' });
yPos += 0.35;
doc.setFont('helvetica', 'normal');
doc.text('2026 GrantFind. All rights reserved.', pageWidth / 2, yPos, { align: 'center' });

// Save
doc.save(pdfPath);
console.log('PDF generated: ' + pdfPath);
console.log('Total pages: ' + doc.getNumberOfPages());
