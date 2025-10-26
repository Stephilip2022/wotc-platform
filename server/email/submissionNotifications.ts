import { getUncachableResendClient } from './client';

export interface SubmissionSuccessData {
  employerName: string;
  employerEmail: string;
  stateCode: string;
  recordCount: number;
  confirmationNumber: string;
  submittedAt: string;
}

export interface SubmissionFailureData {
  employerName: string;
  adminEmail: string;
  stateCode: string;
  recordCount: number;
  errorMessage: string;
  jobId: string;
  retryCount: number;
}

/**
 * Send success notification when a submission completes
 */
export async function sendSubmissionSuccess(
  data: SubmissionSuccessData
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>WOTC Submission Successful</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 40px 32px; background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; text-align: center;">
                ✓ Submission Successful
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 32px;">
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #4b5563;">
                Great news! Your WOTC submissions to <strong>${data.stateCode}</strong> have been successfully processed.
              </p>
              
              <div style="background-color: #f9fafb; border-left: 4px solid #10b981; padding: 20px; margin: 24px 0; border-radius: 4px;">
                <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #111827;">Submission Details</h3>
                <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; color: #4b5563;">
                  <tr>
                    <td style="padding: 6px 0;">Employer:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #111827; text-align: right;">${data.employerName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0;">State:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #111827; text-align: right;">${data.stateCode}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0;">Records:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #111827; text-align: right;">${data.recordCount}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0;">Confirmation:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #111827; text-align: right; font-family: monospace;">${data.confirmationNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0;">Submitted:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #111827; text-align: right;">${data.submittedAt}</td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 14px; color: #6b7280; text-align: center;">
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
    `;
    
    const result = await client.emails.send({
      from: fromEmail,
      to: [data.employerEmail],
      subject: `WOTC Submission Successful - ${data.stateCode}`,
      html,
    });

    console.log(`📧 Submission success email sent to ${data.employerEmail}:`, result.data?.id);
    
    return {
      success: true,
      messageId: result.data?.id || 'unknown',
    };
  } catch (error) {
    console.error('Failed to send submission success email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send failure alert to admin when a submission fails
 */
export async function sendSubmissionFailureAlert(
  data: SubmissionFailureData
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>WOTC Submission Failed</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 40px 32px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; text-align: center;">
                ⚠ Submission Failed
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 32px;">
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #4b5563;">
                A WOTC submission to <strong>${data.stateCode}</strong> has failed.
                ${data.retryCount > 0 ? `This was retry attempt ${data.retryCount}.` : ''}
              </p>
              
              <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 24px 0; border-radius: 4px;">
                <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #111827;">Error Details</h3>
                <p style="margin: 0; font-size: 14px; line-height: 20px; color: #991b1b; font-family: monospace;">
                  ${data.errorMessage}
                </p>
              </div>

              <div style="background-color: #f9fafb; padding: 20px; margin: 24px 0; border-radius: 4px;">
                <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #111827;">Submission Details</h3>
                <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; color: #4b5563;">
                  <tr>
                    <td style="padding: 6px 0;">Employer:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #111827; text-align: right;">${data.employerName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0;">State:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #111827; text-align: right;">${data.stateCode}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0;">Records:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #111827; text-align: right;">${data.recordCount}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0;">Job ID:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #111827; text-align: right; font-family: monospace;">${data.jobId}</td>
                  </tr>
                </table>
              </div>

              <p style="margin: 24px 0; font-size: 14px; line-height: 20px; color: #6b7280;">
                ${data.retryCount < 3 
                  ? 'The system will automatically retry this submission.' 
                  : '<strong>Maximum retry attempts exceeded.</strong> Manual intervention required.'}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 14px; color: #6b7280; text-align: center;">
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
    `;
    
    const result = await client.emails.send({
      from: fromEmail,
      to: [data.adminEmail],
      subject: `⚠ WOTC Submission Failed - ${data.stateCode} - ${data.employerName}`,
      html,
    });

    console.log(`📧 Submission failure alert sent to ${data.adminEmail}:`, result.data?.id);
    
    return {
      success: true,
      messageId: result.data?.id || 'unknown',
    };
  } catch (error) {
    console.error('Failed to send submission failure alert:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
