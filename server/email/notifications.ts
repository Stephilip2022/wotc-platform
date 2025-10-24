import { getUncachableResendClient } from './client';
import {
  renderScreeningInvite,
  renderStatusUpdate,
  renderInvoiceNotification,
  renderDeterminationResult,
  renderWelcomeEmail,
  type ScreeningInviteData,
  type StatusUpdateData,
  type InvoiceNotificationData,
  type DeterminationResultData,
  type WelcomeEmailData,
} from './templates';

export async function sendScreeningInvite(
  to: string,
  data: ScreeningInviteData
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    
    const result = await client.emails.send({
      from: fromEmail,
      to: [to],
      subject: `Complete Your WOTC Screening - ${data.employerName}`,
      html: renderScreeningInvite(data),
    });

    console.log(`📧 Screening invite sent to ${to}:`, result.data?.id);
    
    return {
      success: true,
      messageId: result.data?.id || 'unknown',
    };
  } catch (error) {
    console.error('Failed to send screening invite email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function sendStatusUpdate(
  to: string,
  data: StatusUpdateData
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    
    const result = await client.emails.send({
      from: fromEmail,
      to: [to],
      subject: `WOTC Screening Status Update - ${data.status}`,
      html: renderStatusUpdate(data),
    });

    console.log(`📧 Status update sent to ${to}:`, result.data?.id);
    
    return {
      success: true,
      messageId: result.data?.id || 'unknown',
    };
  } catch (error) {
    console.error('Failed to send status update email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function sendInvoiceNotification(
  to: string,
  data: InvoiceNotificationData
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    
    const result = await client.emails.send({
      from: fromEmail,
      to: [to],
      subject: `New Invoice ${data.invoiceNumber} - ${data.employerName}`,
      html: renderInvoiceNotification(data),
    });

    console.log(`📧 Invoice notification sent to ${to}:`, result.data?.id);
    
    return {
      success: true,
      messageId: result.data?.id || 'unknown',
    };
  } catch (error) {
    console.error('Failed to send invoice notification email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function sendDeterminationResult(
  to: string,
  data: DeterminationResultData
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    
    const isCertified = data.status === 'certified';
    const subject = isCertified 
      ? `WOTC Certification Approved - ${data.employerName}`
      : `WOTC Determination Result - ${data.employerName}`;
    
    const result = await client.emails.send({
      from: fromEmail,
      to: [to],
      subject,
      html: renderDeterminationResult(data),
    });

    console.log(`📧 Determination result sent to ${to}:`, result.data?.id);
    
    return {
      success: true,
      messageId: result.data?.id || 'unknown',
    };
  } catch (error) {
    console.error('Failed to send determination result email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function sendWelcomeEmail(
  to: string,
  data: WelcomeEmailData
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    
    const result = await client.emails.send({
      from: fromEmail,
      to: [to],
      subject: `Welcome to WOTC Platform - ${data.employerName}`,
      html: renderWelcomeEmail(data),
    });

    console.log(`📧 Welcome email sent to ${to}:`, result.data?.id);
    
    return {
      success: true,
      messageId: result.data?.id || 'unknown',
    };
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
