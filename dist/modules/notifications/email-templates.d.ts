export declare function welcomeEmail(firstName: string, role: string, dashboardUrl: string): Promise<{
    html: string;
    text: string;
}>;
export declare function verificationEmail(firstName: string, verifyUrl: string): Promise<{
    html: string;
    text: string;
}>;
export declare function passwordResetEmail(firstName: string, resetUrl: string): Promise<{
    html: string;
    text: string;
}>;
export declare function applicationReceivedEmail(input: {
    firstName: string;
    jobTitle: string;
    companyName: string;
    applicationUrl: string;
}): Promise<{
    html: string;
    text: string;
}>;
export declare function recruiterApplicationEmail(input: {
    firstName: string;
    applicantName: string;
    jobTitle: string;
    applicationUrl: string;
}): Promise<{
    html: string;
    text: string;
}>;
export declare function applicationStatusEmail(input: {
    firstName: string;
    jobTitle: string;
    status: string;
    applicationUrl: string;
}): Promise<{
    html: string;
    text: string;
}>;
export declare function loginAlertEmail(firstName: string, deviceDetails?: string): Promise<{
    html: string;
    text: string;
}>;
export declare function logoutAlertEmail(firstName: string): Promise<{
    html: string;
    text: string;
}>;
export declare function adminAnnouncementEmail(firstName: string, announcementTitle: string, announcementBody: string): Promise<{
    html: string;
    text: string;
}>;
export declare function jobPostConfirmationEmail(firstName: string, jobTitle: string, viewJobUrl: string): Promise<{
    html: string;
    text: string;
}>;
export declare function jobAlertEmail(firstName: string, jobTitle: string, companyName: string, viewJobUrl: string): Promise<{
    html: string;
    text: string;
}>;
