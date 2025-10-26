export interface ScreeningInviteData {
  employeeName: string;
  employerName: string;
  questionnaireUrl: string;
  employerLogoUrl?: string;
  employerBrandColor?: string;
}

export interface StatusUpdateData {
  employeeName: string;
  employerName: string;
  status: string;
  statusDate: string;
  details?: string;
}

export interface InvoiceNotificationData {
  employerName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: string;
  amountDue: string;
  invoiceUrl: string;
}

export interface DeterminationResultData {
  employeeName: string;
  employerName: string;
  status: 'certified' | 'denied';
  targetGroup?: string;
  certificationNumber?: string;
  certificationDate?: string;
  denialReason?: string;
  creditAmount?: string;
}

export interface WelcomeEmailData {
  employerName: string;
  contactName: string;
  dashboardUrl: string;
  questionnaireUrl: string;
  employerLogoUrl?: string;
}

export function renderScreeningInvite(data: ScreeningInviteData): string {
  const brandColor = data.employerBrandColor || '#0ea5e9';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Complete Your WOTC Screening</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          ${data.employerLogoUrl ? `
          <tr>
            <td style="padding: 32px; text-align: center; background-color: #f9fafb;">
              <img src="${data.employerLogoUrl}" alt="${data.employerName}" style="max-height: 60px; max-width: 200px;">
            </td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 40px 32px;">
              <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: #111827;">
                Welcome to ${data.employerName}!
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #4b5563;">
                Hi ${data.employeeName},
              </p>
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #4b5563;">
                As part of your onboarding process, we need you to complete a short screening questionnaire. This helps us determine if you qualify for valuable tax credits that benefit both you and ${data.employerName}.
              </p>
              <p style="margin: 0 0 32px 0; font-size: 16px; line-height: 24px; color: #4b5563;">
                The questionnaire takes about 5-7 minutes to complete and covers important eligibility criteria.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${data.questionnaireUrl}" style="display: inline-block; padding: 14px 32px; background-color: ${brandColor}; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 500;">
                      Start Questionnaire
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 32px 0 0 0; font-size: 14px; line-height: 20px; color: #6b7280;">
                Or copy and paste this link into your browser:<br>
                <a href="${data.questionnaireUrl}" style="color: ${brandColor}; word-break: break-all;">${data.questionnaireUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 14px; line-height: 20px; color: #6b7280; text-align: center;">
                This is an automated message from ${data.employerName}'s WOTC platform.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function renderStatusUpdate(data: StatusUpdateData): string {
  const statusColors: Record<string, string> = {
    pending: '#f59e0b',
    submitted: '#3b82f6',
    certified: '#10b981',
    denied: '#ef4444',
  };
  
  const statusColor = statusColors[data.status.toLowerCase()] || '#6b7280';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WOTC Screening Status Update</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 40px 32px;">
              <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: #111827;">
                WOTC Screening Status Update
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #4b5563;">
                Hi ${data.employeeName},
              </p>
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #4b5563;">
                Your WOTC screening status with ${data.employerName} has been updated.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td style="padding: 20px; background-color: #f9fafb; border-left: 4px solid ${statusColor}; border-radius: 4px;">
                    <div style="margin: 0 0 8px 0; font-size: 14px; font-weight: 500; color: #6b7280; text-transform: uppercase;">
                      New Status
                    </div>
                    <div style="margin: 0; font-size: 18px; font-weight: 600; color: ${statusColor};">
                      ${data.status.toUpperCase()}
                    </div>
                    <div style="margin: 8px 0 0 0; font-size: 14px; color: #6b7280;">
                      Updated on ${data.statusDate}
                    </div>
                  </td>
                </tr>
              </table>
              ${data.details ? `
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #4b5563;">
                ${data.details}
              </p>
              ` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 14px; line-height: 20px; color: #6b7280; text-align: center;">
                This is an automated message from ${data.employerName}'s WOTC platform.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function renderInvoiceNotification(data: InvoiceNotificationData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Invoice - ${data.invoiceNumber}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 40px 32px;">
              <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: #111827;">
                New Invoice
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #4b5563;">
                Hello ${data.employerName},
              </p>
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #4b5563;">
                A new invoice has been generated for your WOTC services.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 32px 0; border: 1px solid #e5e7eb; border-radius: 6px;">
                <tr>
                  <td style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
                    <div style="font-size: 14px; color: #6b7280;">Invoice Number</div>
                    <div style="font-size: 16px; font-weight: 600; color: #111827; margin-top: 4px;">${data.invoiceNumber}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
                    <div style="font-size: 14px; color: #6b7280;">Invoice Date</div>
                    <div style="font-size: 16px; font-weight: 600; color: #111827; margin-top: 4px;">${data.invoiceDate}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
                    <div style="font-size: 14px; color: #6b7280;">Due Date</div>
                    <div style="font-size: 16px; font-weight: 600; color: #111827; margin-top: 4px;">${data.dueDate}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px; background-color: #f9fafb;">
                    <div style="font-size: 14px; color: #6b7280;">Amount Due</div>
                    <div style="font-size: 24px; font-weight: 700; color: #0ea5e9; margin-top: 4px;">${data.amountDue}</div>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${data.invoiceUrl}" style="display: inline-block; padding: 14px 32px; background-color: #0ea5e9; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 500;">
                      View Invoice
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 32px 0 0 0; font-size: 14px; line-height: 20px; color: #6b7280;">
                Payment will be automatically processed using your saved payment method.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 14px; line-height: 20px; color: #6b7280; text-align: center;">
                This is an automated message from the WOTC Platform.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function renderDeterminationResult(data: DeterminationResultData): string {
  const isCertified = data.status === 'certified';
  const statusColor = isCertified ? '#10b981' : '#ef4444';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WOTC Determination Result</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 40px 32px;">
              <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: #111827;">
                WOTC Determination Result
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #4b5563;">
                Hi ${data.employeeName},
              </p>
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #4b5563;">
                We have received a determination from the state workforce agency regarding your WOTC screening with ${data.employerName}.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td style="padding: 24px; background-color: #f9fafb; border-left: 4px solid ${statusColor}; border-radius: 4px; text-align: center;">
                    <div style="margin: 0 0 8px 0; font-size: 14px; font-weight: 500; color: #6b7280; text-transform: uppercase;">
                      Status
                    </div>
                    <div style="margin: 0 0 16px 0; font-size: 28px; font-weight: 700; color: ${statusColor};">
                      ${isCertified ? 'CERTIFIED' : 'DENIED'}
                    </div>
                    ${isCertified && data.targetGroup ? `
                    <div style="margin: 0; font-size: 16px; color: #4b5563;">
                      Target Group: <strong>${data.targetGroup}</strong>
                    </div>
                    ` : ''}
                  </td>
                </tr>
              </table>
              ${isCertified ? `
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #4b5563;">
                Congratulations! You have been certified for the Work Opportunity Tax Credit. This certification allows ${data.employerName} to claim a tax credit, which helps support your employment.
              </p>
              ${data.certificationNumber ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0; border: 1px solid #e5e7eb; border-radius: 6px;">
                <tr>
                  <td style="padding: 16px;">
                    <div style="font-size: 14px; color: #6b7280;">Certification Number</div>
                    <div style="font-size: 16px; font-weight: 600; color: #111827; margin-top: 4px; font-family: 'JetBrains Mono', monospace;">${data.certificationNumber}</div>
                  </td>
                </tr>
                ${data.certificationDate ? `
                <tr>
                  <td style="padding: 16px; border-top: 1px solid #e5e7eb;">
                    <div style="font-size: 14px; color: #6b7280;">Certification Date</div>
                    <div style="font-size: 16px; font-weight: 600; color: #111827; margin-top: 4px;">${data.certificationDate}</div>
                  </td>
                </tr>
                ` : ''}
                ${data.creditAmount ? `
                <tr>
                  <td style="padding: 16px; border-top: 1px solid #e5e7eb; background-color: #ecfdf5;">
                    <div style="font-size: 14px; color: #6b7280;">Estimated Tax Credit</div>
                    <div style="font-size: 20px; font-weight: 700; color: #10b981; margin-top: 4px;">${data.creditAmount}</div>
                  </td>
                </tr>
                ` : ''}
              </table>
              ` : ''}
              ` : `
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #4b5563;">
                Unfortunately, your WOTC screening was not approved for certification. This does not affect your employment with ${data.employerName}.
              </p>
              ${data.denialReason ? `
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 20px; color: #6b7280; padding: 16px; background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px;">
                <strong>Reason:</strong> ${data.denialReason}
              </p>
              ` : ''}
              `}
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 14px; line-height: 20px; color: #6b7280; text-align: center;">
                This is an automated message from ${data.employerName}'s WOTC platform.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function renderWelcomeEmail(data: WelcomeEmailData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to WOTC Platform</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          ${data.employerLogoUrl ? `
          <tr>
            <td style="padding: 32px; text-align: center; background-color: #f9fafb;">
              <img src="${data.employerLogoUrl}" alt="${data.employerName}" style="max-height: 60px; max-width: 200px;">
            </td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 40px 32px;">
              <h1 style="margin: 0 0 16px 0; font-size: 28px; font-weight: 700; color: #111827;">
                Welcome to the WOTC Platform!
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #4b5563;">
                Hi ${data.contactName},
              </p>
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #4b5563;">
                Thank you for registering <strong>${data.employerName}</strong> with our WOTC optimization platform. Your account has been successfully created, and you're ready to start maximizing your tax credit opportunities.
              </p>
              <div style="margin: 0 0 32px 0; padding: 24px; background-color: #f0f9ff; border-radius: 6px; border-left: 4px solid #0ea5e9;">
                <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: #0369a1;">
                  Quick Start Guide
                </h2>
                <ol style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 15px; line-height: 24px;">
                  <li style="margin-bottom: 8px;">Access your employer dashboard to manage your account</li>
                  <li style="margin-bottom: 8px;">Add employees and invite them to complete WOTC screenings</li>
                  <li style="margin-bottom: 8px;">Track screening submissions and certifications</li>
                  <li style="margin-bottom: 8px;">Monitor your tax credit calculations and savings</li>
                </ol>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 32px 0;">
                <tr>
                  <td align="center">
                    <a href="${data.dashboardUrl}" style="display: inline-block; padding: 14px 32px; background-color: #0ea5e9; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 500; margin-right: 12px;">
                      Go to Dashboard
                    </a>
                    <a href="${data.questionnaireUrl}" style="display: inline-block; padding: 14px 32px; background-color: #ffffff; color: #0ea5e9; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 500; border: 2px solid #0ea5e9;">
                      View Sample Questionnaire
                    </a>
                  </td>
                </tr>
              </table>
              <div style="margin: 0; padding: 20px; background-color: #f9fafb; border-radius: 6px;">
                <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #111827;">
                  Need Help?
                </h3>
                <p style="margin: 0; font-size: 14px; line-height: 20px; color: #6b7280;">
                  Our support team is here to assist you with any questions about the WOTC program, screening process, or platform features. Contact us anytime at support@wotc-platform.com
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 14px; line-height: 20px; color: #6b7280; text-align: center;">
                This is an automated welcome message from the WOTC Platform.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export interface SubmissionSuccessData {
  employerName: string;
  stateCode: string;
  recordCount: number;
  confirmationNumber: string;
  submittedAt: string;
  dashboardUrl: string;
}

export interface SubmissionFailureData {
  employerName: string;
  stateCode: string;
  recordCount: number;
  errorMessage: string;
  jobId: string;
  retryCount: number;
  dashboardUrl: string;
}

export interface BatchCompletionData {
  totalJobs: number;
  successfulJobs: number;
  failedJobs: number;
  totalScreenings: number;
  dateRange: string;
  dashboardUrl: string;
}

export function renderSubmissionSuccess(data: SubmissionSuccessData): string {
  return \`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WOTC Submission Successful</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 40px 32px; background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; text-align: center;">
                Submission Successful
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 32px;">
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #4b5563;">
                Great news! Your WOTC submissions to <strong>\${data.stateCode}</strong> have been successfully processed.
              </p>
              
              <div style="background-color: #f9fafb; border-left: 4px solid #10b981; padding: 20px; margin: 24px 0; border-radius: 4px;">
                <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #111827;">
                  Submission Details
                </h3>
                <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; color: #4b5563;">
                  <tr>
                    <td style="padding: 6px 0;">Employer:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #111827; text-align: right;">\${data.employerName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0;">State:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #111827; text-align: right;">\${data.stateCode}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0;">Records Submitted:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #111827; text-align: right;">\${data.recordCount}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0;">Confirmation #:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #111827; text-align: right; font-family: monospace;">\${data.confirmationNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0;">Submitted At:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #111827; text-align: right;">\${data.submittedAt}</td>
                  </tr>
                </table>
              </div>

              <p style="margin: 24px 0; font-size: 14px; line-height: 20px; color: #6b7280;">
                The state portal has accepted your submissions. You can track the status of determinations in your dashboard.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 32px 0;">
                <tr>
                  <td align="center">
                    <a href="\${data.dashboardUrl}" style="display: inline-block; padding: 14px 32px; background-color: #10b981; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 500;">
                      View Dashboard
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 14px; line-height: 20px; color: #6b7280; text-align: center;">
                This is an automated notification from the WOTC Platform.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  \`.trim();
}

export function renderSubmissionFailure(data: SubmissionFailureData): string {
  return \`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WOTC Submission Failed</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 40px 32px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; text-align: center;">
                Submission Failed
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 32px;">
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #4b5563;">
                We encountered an issue submitting your WOTC records to <strong>\${data.stateCode}</strong>.
                \${data.retryCount > 0 ? \`This was retry attempt \${data.retryCount}.\` : ''}
              </p>
              
              <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 24px 0; border-radius: 4px;">
                <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #111827;">
                  Error Details
                </h3>
                <p style="margin: 0; font-size: 14px; line-height: 20px; color: #991b1b; font-family: monospace;">
                  \${data.errorMessage}
                </p>
              </div>

              <div style="background-color: #f9fafb; padding: 20px; margin: 24px 0; border-radius: 4px;">
                <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #111827;">
                  Submission Details
                </h3>
                <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; color: #4b5563;">
                  <tr>
                    <td style="padding: 6px 0;">Employer:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #111827; text-align: right;">\${data.employerName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0;">State:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #111827; text-align: right;">\${data.stateCode}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0;">Records:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #111827; text-align: right;">\${data.recordCount}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0;">Job ID:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #111827; text-align: right; font-family: monospace;">\${data.jobId}</td>
                  </tr>
                </table>
              </div>

              <p style="margin: 24px 0; font-size: 14px; line-height: 20px; color: #6b7280;">
                \${data.retryCount < 3 
                  ? 'Our system will automatically retry this submission. You can also manually retry from your dashboard.' 
                  : 'This submission has exceeded the maximum retry attempts. Please review the error and contact support if needed.'}
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 32px 0;">
                <tr>
                  <td align="center">
                    <a href="\${data.dashboardUrl}" style="display: inline-block; padding: 14px 32px; background-color: #ef4444; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 500;">
                      View in Dashboard
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 14px; line-height: 20px; color: #6b7280; text-align: center;">
                This is an automated alert from the WOTC Platform.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  \`.trim();
}
