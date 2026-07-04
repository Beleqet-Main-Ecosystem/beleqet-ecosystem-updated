"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.welcomeEmail = welcomeEmail;
exports.verificationEmail = verificationEmail;
exports.passwordResetEmail = passwordResetEmail;
exports.applicationReceivedEmail = applicationReceivedEmail;
exports.recruiterApplicationEmail = recruiterApplicationEmail;
exports.applicationStatusEmail = applicationStatusEmail;
exports.loginAlertEmail = loginAlertEmail;
exports.logoutAlertEmail = logoutAlertEmail;
exports.adminAnnouncementEmail = adminAnnouncementEmail;
exports.jobPostConfirmationEmail = jobPostConfirmationEmail;
exports.jobAlertEmail = jobAlertEmail;
const jsx_runtime_1 = require("react/jsx-runtime");
const components_1 = require("@react-email/components");
const render_1 = require("@react-email/render");
const colors = {
    brand: '#00653B',
    dark: '#041603',
    lime: '#D8FF3E',
    page: '#F5F7FA',
    muted: '#64748B',
    border: '#E2E8F0',
};
function BeleqetEmail(props) {
    return ((0, jsx_runtime_1.jsxs)(components_1.Html, { lang: "en", children: [(0, jsx_runtime_1.jsx)(components_1.Head, {}), (0, jsx_runtime_1.jsx)(components_1.Preview, { children: props.preview }), (0, jsx_runtime_1.jsx)(components_1.Body, { style: styles.body, children: (0, jsx_runtime_1.jsxs)(components_1.Container, { style: styles.container, children: [(0, jsx_runtime_1.jsxs)(components_1.Section, { style: styles.header, children: [(0, jsx_runtime_1.jsx)(components_1.Text, { style: styles.logo, children: "BELEQET" }), (0, jsx_runtime_1.jsx)(components_1.Text, { style: styles.tagline, children: "Work. Talent. Opportunity." })] }), (0, jsx_runtime_1.jsxs)(components_1.Section, { style: styles.content, children: [(0, jsx_runtime_1.jsx)(components_1.Text, { style: styles.eyebrow, children: props.eyebrow }), (0, jsx_runtime_1.jsx)(components_1.Heading, { as: "h1", style: styles.heading, children: props.title }), (0, jsx_runtime_1.jsx)(components_1.Text, { style: styles.text, children: props.greeting }), props.paragraphs.map((paragraph) => ((0, jsx_runtime_1.jsx)(components_1.Text, { style: styles.text, children: paragraph }, paragraph))), props.detailValue && ((0, jsx_runtime_1.jsxs)(components_1.Section, { style: styles.detail, children: [(0, jsx_runtime_1.jsx)(components_1.Text, { style: styles.detailLabel, children: props.detailLabel }), (0, jsx_runtime_1.jsx)(components_1.Text, { style: styles.detailValue, children: props.detailValue })] })), props.action && ((0, jsx_runtime_1.jsx)(components_1.Section, { style: styles.actionRow, children: (0, jsx_runtime_1.jsx)(components_1.Button, { href: props.action.url, style: styles.button, children: props.action.label }) })), props.footnote && (0, jsx_runtime_1.jsx)(components_1.Text, { style: styles.footnote, children: props.footnote })] }), (0, jsx_runtime_1.jsxs)(components_1.Section, { style: styles.footer, children: [(0, jsx_runtime_1.jsx)(components_1.Text, { style: styles.footerText, children: "You received this transactional email because you have a Beleqet account or interacted with a job listing on Beleqet." }), (0, jsx_runtime_1.jsxs)(components_1.Text, { style: styles.footerText, children: [(0, jsx_runtime_1.jsx)(components_1.Link, { href: "https://beleqet-interview-task-mu.vercel.app", style: styles.footerLink, children: "Visit Beleqet" }), ' · ', "Addis Ababa, Ethiopia"] }), (0, jsx_runtime_1.jsx)(components_1.Hr, { style: styles.hr }), (0, jsx_runtime_1.jsxs)(components_1.Text, { style: styles.copyright, children: ["\u00A9 ", new Date().getFullYear(), " Beleqet. All rights reserved."] })] })] }) })] }));
}
async function renderTemplate(content) {
    const html = await (0, render_1.render)((0, jsx_runtime_1.jsx)(BeleqetEmail, { ...content }));
    return { html, text: (0, render_1.toPlainText)(html) };
}
function welcomeEmail(firstName, role, dashboardUrl) {
    const roleLabel = role === 'EMPLOYER' ? 'employer' : role === 'FREELANCER' ? 'freelancer' : 'job seeker';
    const roleAction = role === 'EMPLOYER'
        ? 'Post your first job listing and start reaching thousands of talented candidates across Ethiopia.'
        : role === 'FREELANCER'
            ? 'Complete your freelancer profile and start bidding on exciting projects.'
            : 'Browse open positions, save your favourites, and apply with one click.';
    return renderTemplate({
        preview: `Welcome to Beleqet, ${firstName}! Your account is ready.`,
        eyebrow: 'Welcome aboard',
        title: `Great to have you, ${firstName}!`,
        greeting: `Hello ${firstName},`,
        paragraphs: [
            `Your Beleqet account has been created successfully as a ${roleLabel}.`,
            roleAction,
            'If you have any questions or need help getting started, our support team is always here for you.',
        ],
        action: { label: 'Go to my dashboard', url: dashboardUrl },
        footnote: 'You received this email because you created a Beleqet account. Welcome to the platform!',
    });
}
function verificationEmail(firstName, verifyUrl) {
    return renderTemplate({
        preview: 'Verify your email to finish setting up your Beleqet account.',
        eyebrow: 'Account verification',
        title: 'Confirm your email address',
        greeting: `Hello ${firstName},`,
        paragraphs: ['Welcome to Beleqet. Verify your email address to secure your account and access all platform features.'],
        action: { label: 'Verify email address', url: verifyUrl },
        footnote: 'This verification link expires in 24 hours. If you did not create this account, you can ignore this email.',
    });
}
function passwordResetEmail(firstName, resetUrl) {
    return renderTemplate({
        preview: 'Use this secure link to reset your Beleqet password.',
        eyebrow: 'Account security',
        title: 'Reset your password',
        greeting: `Hello ${firstName},`,
        paragraphs: ['We received a request to reset your Beleqet password. Use the secure button below to choose a new password.'],
        action: { label: 'Reset password', url: resetUrl },
        footnote: 'This link expires in one hour. If you did not request a password reset, no action is required.',
    });
}
function applicationReceivedEmail(input) {
    return renderTemplate({
        preview: `Your application for ${input.jobTitle} has been received.`,
        eyebrow: 'Application submitted',
        title: 'Your application is on its way',
        greeting: `Hello ${input.firstName},`,
        paragraphs: [`We received your application and shared it with ${input.companyName}. You can track its progress from your application dashboard.`],
        detailLabel: 'Position',
        detailValue: input.jobTitle,
        action: { label: 'Track application', url: input.applicationUrl },
    });
}
function recruiterApplicationEmail(input) {
    return renderTemplate({
        preview: `${input.applicantName} applied for ${input.jobTitle}.`,
        eyebrow: 'New candidate',
        title: 'A new application has arrived',
        greeting: `Hello ${input.firstName},`,
        paragraphs: [`${input.applicantName} submitted an application for your open position. Review their profile and application materials in your hiring workspace.`],
        detailLabel: 'Position',
        detailValue: input.jobTitle,
        action: { label: 'Review applicant', url: input.applicationUrl },
    });
}
function applicationStatusEmail(input) {
    const readableStatus = input.status.replaceAll('_', ' ').toLowerCase();
    return renderTemplate({
        preview: `Your application status for ${input.jobTitle} has changed.`,
        eyebrow: 'Application update',
        title: 'Your application status changed',
        greeting: `Hello ${input.firstName},`,
        paragraphs: [`There is a new update from the hiring team regarding your application for ${input.jobTitle}.`],
        detailLabel: 'Current status',
        detailValue: readableStatus.charAt(0).toUpperCase() + readableStatus.slice(1),
        action: { label: 'View application', url: input.applicationUrl },
    });
}
function loginAlertEmail(firstName, deviceDetails) {
    const dateStr = new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' });
    return renderTemplate({
        preview: 'New login detected on your Beleqet account.',
        eyebrow: 'Security Alert',
        title: 'New Login Detected',
        greeting: `Hello ${firstName},`,
        paragraphs: [
            `We detected a successful sign-in to your Beleqet account on ${dateStr} (East Africa Time).`,
            deviceDetails ? `Device / Browser info: ${deviceDetails}` : 'If this was you, no action is required.',
            'If you do not recognize this login, please change your password immediately to protect your account.'
        ],
        footnote: 'This is a security notification. Do not share your login credentials with anyone.',
    });
}
function logoutAlertEmail(firstName) {
    return renderTemplate({
        preview: 'You have been successfully logged out from Beleqet.',
        eyebrow: 'Account Security',
        title: 'Logged Out Successfully',
        greeting: `Hello ${firstName},`,
        paragraphs: [
            'You have successfully signed out of your Beleqet session. Your active login token for this device has been invalidated.',
            'Thank you for using Beleqet to manage your professional path.'
        ],
    });
}
function adminAnnouncementEmail(firstName, announcementTitle, announcementBody) {
    return renderTemplate({
        preview: `Announcement: ${announcementTitle}`,
        eyebrow: 'System Announcement',
        title: announcementTitle,
        greeting: `Hello ${firstName},`,
        paragraphs: [announcementBody],
    });
}
function jobPostConfirmationEmail(firstName, jobTitle, viewJobUrl) {
    return renderTemplate({
        preview: `Your job listing "${jobTitle}" is live!`,
        eyebrow: 'Job Posted',
        title: 'Your Job Listing is Live',
        greeting: `Hello ${firstName},`,
        paragraphs: [
            `Congratulations! Your new job posting for "${jobTitle}" has been successfully published on Beleqet.`,
            'Job seekers can now view and apply to your vacancy. You will receive email notifications as soon as candidates submit applications.'
        ],
        action: { label: 'View Job Listing', url: viewJobUrl },
    });
}
function jobAlertEmail(firstName, jobTitle, companyName, viewJobUrl) {
    return renderTemplate({
        preview: `New job matching your profile: ${jobTitle} at ${companyName}.`,
        eyebrow: 'Job Alert',
        title: 'New Opportunity for You',
        greeting: `Hello ${firstName},`,
        paragraphs: [
            `A new job matching your interests has been posted: "${jobTitle}" at ${companyName}.`,
            'Be one of the first to apply to increase your chances of getting hired!'
        ],
        action: { label: 'View Vacancy', url: viewJobUrl },
    });
}
const styles = {
    body: { backgroundColor: colors.page, color: colors.dark, fontFamily: 'Arial, Helvetica, sans-serif', margin: 0, padding: '32px 12px' },
    container: { backgroundColor: '#FFFFFF', border: `1px solid ${colors.border}`, borderRadius: '18px', margin: '0 auto', maxWidth: '600px', overflow: 'hidden' },
    header: { backgroundColor: colors.dark, padding: '28px 36px' },
    logo: { color: colors.lime, fontSize: '22px', fontWeight: 800, letterSpacing: '2px', margin: 0 },
    tagline: { color: '#FFFFFF', fontSize: '12px', margin: '5px 0 0', opacity: 0.7 },
    content: { padding: '36px' },
    eyebrow: { color: colors.brand, fontSize: '12px', fontWeight: 700, letterSpacing: '1.4px', margin: '0 0 10px', textTransform: 'uppercase' },
    heading: { color: colors.dark, fontSize: '30px', lineHeight: '1.2', margin: '0 0 24px' },
    text: { color: '#334155', fontSize: '16px', lineHeight: '1.65', margin: '0 0 16px' },
    detail: { backgroundColor: '#F7F9F8', borderLeft: `4px solid ${colors.brand}`, borderRadius: '8px', margin: '24px 0', padding: '16px 18px' },
    detailLabel: { color: colors.muted, fontSize: '11px', fontWeight: 700, letterSpacing: '1px', margin: '0 0 5px', textTransform: 'uppercase' },
    detailValue: { color: colors.dark, fontSize: '17px', fontWeight: 700, margin: 0, textTransform: 'capitalize' },
    actionRow: { margin: '28px 0 20px' },
    button: { backgroundColor: colors.brand, borderRadius: '999px', color: '#FFFFFF', display: 'inline-block', fontSize: '15px', fontWeight: 700, padding: '13px 24px', textDecoration: 'none' },
    footnote: { color: colors.muted, fontSize: '13px', lineHeight: '1.55', margin: '22px 0 0' },
    footer: { backgroundColor: '#F7F9F8', borderTop: `1px solid ${colors.border}`, padding: '24px 36px' },
    footerText: { color: colors.muted, fontSize: '12px', lineHeight: '1.55', margin: '0 0 8px' },
    footerLink: { color: colors.brand, fontWeight: 700, textDecoration: 'none' },
    hr: { borderColor: colors.border, margin: '18px 0' },
    copyright: { color: '#94A3B8', fontSize: '11px', margin: 0 },
};
//# sourceMappingURL=email-templates.js.map