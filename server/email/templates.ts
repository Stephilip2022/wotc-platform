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
  form9198Url?: string;
  engagementLetterUrl?: string;
  feePercentage?: string;
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

// Retention alert email
export interface RetentionAlertData {
  employerName: string;
  contactName: string;
  employeeName: string;
  currentHours: number;
  targetHours: number;
  percentComplete: number;
  daysRemaining: number;
  potentialCredit: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  dashboardUrl: string;
}

export function renderRetentionAlert(data: RetentionAlertData): string {
  const riskColors = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#f97316',
    critical: '#ef4444',
  };
  const riskColor = riskColors[data.riskLevel];

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Retention Alert - Action Required</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 24px 32px; background-color: ${riskColor};">
              <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #ffffff;">
                Retention Alert: ${data.riskLevel.toUpperCase()} Priority
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 32px;">
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #4b5563;">
                Hi ${data.contactName},
              </p>
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #4b5563;">
                An employee is approaching their WOTC milestone and may need retention support to ensure full credit capture.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0; border: 1px solid #e5e7eb; border-radius: 6px;">
                <tr>
                  <td style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
                    <div style="font-size: 14px; color: #6b7280;">Employee</div>
                    <div style="font-size: 16px; font-weight: 600; color: #111827; margin-top: 4px;">${data.employeeName}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
                    <div style="font-size: 14px; color: #6b7280;">Progress to Milestone</div>
                    <div style="margin-top: 8px; background-color: #e5e7eb; border-radius: 999px; height: 12px; overflow: hidden;">
                      <div style="width: ${data.percentComplete}%; height: 100%; background-color: ${riskColor};"></div>
                    </div>
                    <div style="font-size: 14px; color: #111827; margin-top: 4px;">${data.currentHours} / ${data.targetHours} hours (${data.percentComplete}%)</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
                    <div style="font-size: 14px; color: #6b7280;">Days Remaining</div>
                    <div style="font-size: 16px; font-weight: 600; color: #111827; margin-top: 4px;">${data.daysRemaining} days</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px; background-color: #fef3c7;">
                    <div style="font-size: 14px; color: #6b7280;">Potential Credit at Risk</div>
                    <div style="font-size: 20px; font-weight: 700; color: #d97706; margin-top: 4px;">${data.potentialCredit}</div>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${data.dashboardUrl}" style="display: inline-block; padding: 14px 32px; background-color: #0ea5e9; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 500;">
                      View Retention Dashboard
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 14px; line-height: 20px; color: #6b7280; text-align: center;">
                This is an automated retention alert from ${data.employerName}'s WOTC platform.
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

// Screening reminder email
export interface ScreeningReminderData {
  employeeName: string;
  employerName: string;
  questionnaireUrl: string;
  daysRemaining: number;
  completionPercentage: number;
  employerLogoUrl?: string;
  employerBrandColor?: string;
}

export function renderScreeningReminder(data: ScreeningReminderData): string {
  const brandColor = data.employerBrandColor || '#0ea5e9';
  const urgency = data.daysRemaining <= 3 ? 'urgent' : data.daysRemaining <= 7 ? 'soon' : 'normal';
  const urgencyColors = { urgent: '#ef4444', soon: '#f59e0b', normal: '#0ea5e9' };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Complete Your WOTC Screening - Reminder</title>
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
              <div style="margin: 0 0 24px 0; padding: 12px 16px; background-color: ${urgencyColors[urgency]}15; border-left: 4px solid ${urgencyColors[urgency]}; border-radius: 4px;">
                <span style="font-size: 14px; font-weight: 600; color: ${urgencyColors[urgency]};">
                  ${urgency === 'urgent' ? 'Action Required - Deadline Approaching!' : urgency === 'soon' ? 'Reminder: Complete Soon' : 'Friendly Reminder'}
                </span>
              </div>
              <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: #111827;">
                Complete Your Screening
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #4b5563;">
                Hi ${data.employeeName},
              </p>
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #4b5563;">
                We noticed you haven't finished your WOTC screening questionnaire for ${data.employerName}. 
                ${data.completionPercentage > 0 ? `You're ${data.completionPercentage}% complete - just a few more questions to go!` : 'It only takes about 5-7 minutes to complete.'}
              </p>
              ${data.completionPercentage > 0 ? `
              <div style="margin: 0 0 24px 0;">
                <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">Your progress</div>
                <div style="background-color: #e5e7eb; border-radius: 999px; height: 12px; overflow: hidden;">
                  <div style="width: ${data.completionPercentage}%; height: 100%; background-color: ${brandColor};"></div>
                </div>
                <div style="font-size: 14px; color: #111827; margin-top: 4px;">${data.completionPercentage}% complete</div>
              </div>
              ` : ''}
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${data.questionnaireUrl}" style="display: inline-block; padding: 14px 32px; background-color: ${brandColor}; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 500;">
                      ${data.completionPercentage > 0 ? 'Continue Questionnaire' : 'Start Questionnaire'}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 32px 0 0 0; font-size: 14px; line-height: 20px; color: #6b7280;">
                ${data.daysRemaining > 0 ? `Please complete within ${data.daysRemaining} days.` : 'Please complete as soon as possible.'}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 14px; line-height: 20px; color: #6b7280; text-align: center;">
                This is an automated reminder from ${data.employerName}'s WOTC platform.
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

// Admin submission alert email
export interface AdminSubmissionAlertData {
  adminName: string;
  alertType: 'success' | 'failure' | 'stuck' | 'batch_complete';
  submissionCount?: number;
  successCount?: number;
  failureCount?: number;
  statePortal?: string;
  employerName?: string;
  errorDetails?: string;
  dashboardUrl: string;
}

export function renderAdminSubmissionAlert(data: AdminSubmissionAlertData): string {
  const alertStyles = {
    success: { bg: '#ecfdf5', border: '#10b981', icon: '✓', title: 'Submission Successful' },
    failure: { bg: '#fef2f2', border: '#ef4444', icon: '!', title: 'Submission Failed' },
    stuck: { bg: '#fefce8', border: '#f59e0b', icon: '⚠', title: 'Stuck Submissions Detected' },
    batch_complete: { bg: '#eff6ff', border: '#3b82f6', icon: '✓', title: 'Batch Processing Complete' },
  };
  const style = alertStyles[data.alertType];

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${style.title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 24px 32px; background-color: ${style.bg}; border-left: 4px solid ${style.border};">
              <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #111827;">
                ${style.icon} ${style.title}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 32px;">
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #4b5563;">
                Hi ${data.adminName},
              </p>
              ${data.alertType === 'batch_complete' ? `
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #4b5563;">
                A batch of ${data.submissionCount} submissions has completed processing.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0; border: 1px solid #e5e7eb; border-radius: 6px;">
                <tr>
                  <td style="padding: 16px; border-bottom: 1px solid #e5e7eb; width: 50%;">
                    <div style="font-size: 14px; color: #6b7280;">Successful</div>
                    <div style="font-size: 20px; font-weight: 600; color: #10b981; margin-top: 4px;">${data.successCount}</div>
                  </td>
                  <td style="padding: 16px; border-bottom: 1px solid #e5e7eb; width: 50%;">
                    <div style="font-size: 14px; color: #6b7280;">Failed</div>
                    <div style="font-size: 20px; font-weight: 600; color: #ef4444; margin-top: 4px;">${data.failureCount}</div>
                  </td>
                </tr>
              </table>
              ` : data.alertType === 'failure' ? `
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #4b5563;">
                A submission to ${data.statePortal || 'state portal'} for ${data.employerName || 'an employer'} has failed.
              </p>
              ${data.errorDetails ? `
              <div style="margin: 0 0 24px 0; padding: 16px; background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px; font-family: monospace; font-size: 13px; color: #991b1b;">
                ${data.errorDetails}
              </div>
              ` : ''}
              ` : data.alertType === 'stuck' ? `
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #4b5563;">
                ${data.submissionCount} submissions have been stuck in processing state for an extended period. Manual intervention may be required.
              </p>
              ` : `
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #4b5563;">
                A submission to ${data.statePortal || 'state portal'} for ${data.employerName || 'an employer'} has completed successfully.
              </p>
              `}
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${data.dashboardUrl}" style="display: inline-block; padding: 14px 32px; background-color: #0ea5e9; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 500;">
                      View Submission Dashboard
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 14px; line-height: 20px; color: #6b7280; text-align: center;">
                This is an automated admin alert from the WOTC Platform.
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
              ${data.form9198Url || data.engagementLetterUrl ? `
              <div style="margin: 0 0 32px 0; padding: 24px; background-color: #fef3c7; border-radius: 6px; border-left: 4px solid #f59e0b;">
                <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: #92400e;">
                  Action Required: Sign Your Documents
                </h2>
                <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 24px; color: #4b5563;">
                  To activate your WOTC screening account, please review and electronically sign the following documents:
                </p>
                <ul style="margin: 0 0 16px 0; padding-left: 20px; color: #4b5563; font-size: 15px; line-height: 28px;">
                  ${data.form9198Url ? `<li><a href="${data.form9198Url}" style="color: #0ea5e9; text-decoration: underline; font-weight: 500;">ETA Form 9198 (Pre-Screening Notice)</a> - Required for WOTC program participation</li>` : ''}
                  ${data.engagementLetterUrl ? `<li><a href="${data.engagementLetterUrl}" style="color: #0ea5e9; text-decoration: underline; font-weight: 500;">Engagement Letter</a> - Service agreement for WOTC processing${data.feePercentage ? ` (${data.feePercentage}% service fee)` : ''}</li>` : ''}
                </ul>
              </div>
              ` : ''}
              <div style="margin: 0 0 32px 0; padding: 24px; background-color: #f0f9ff; border-radius: 6px; border-left: 4px solid #0ea5e9;">
                <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: #0369a1;">
                  Quick Start Guide
                </h2>
                <ol style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 15px; line-height: 24px;">
                  <li style="margin-bottom: 8px;">Sign your ETA Form 9198 and Engagement Letter (see above)</li>
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
                      Set Up Your Account
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
                  Our support team is here to assist you with any questions about the WOTC program, screening process, or platform features. Contact us anytime at support@rockerbox.app
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

