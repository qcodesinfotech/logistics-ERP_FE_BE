import nodemailer from "nodemailer";

// Create a transporter
// In development, we use a mock/console transporter or a service like Ethereal
// For production, you would use real SMTP credentials
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.ethereal.email",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER || "ethereal.user@example.com",
    pass: process.env.SMTP_PASS || "ethereal.pass",
  },
});

export async function sendLeaveRequestNotification(data: {
  employeeName: string;
  startDate: string;
  endDate: string;
  totalDays: string;
  reason: string;
  coveringEmployeeName?: string;
  recipientEmails: string[];
}) {
  const { employeeName, startDate, endDate, totalDays, reason, coveringEmployeeName, recipientEmails } = data;

  const mailOptions = {
    from: `"Logistics ERP System" <noreply@logisticserp.com>`,
    to: recipientEmails.join(", "),
    subject: `New Leave Request: ${employeeName}`,
    text: `
      Hello,

      A new leave request has been submitted.

      Employee: ${employeeName}
      Period: ${startDate} to ${endDate}
      Total Days: ${totalDays}
      Reason: ${reason}
      Covering Employee: ${coveringEmployeeName || "None"}

      Please login to the system to review and approve/reject this request.

      Regards,
      Logistics ERP System
    `,
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>New Leave Request</h2>
        <p>A new leave request has been submitted.</p>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Employee:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${employeeName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Period:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${startDate} to ${endDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Total Days:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${totalDays}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Reason:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${reason}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Covering Employee:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${coveringEmployeeName || "None"}</td>
          </tr>
        </table>
        <p>Please login to the system to review and approve/reject this request.</p>
        <hr />
        <p style="font-size: 12px; color: #777;">Regards,<br />Logistics ERP System</p>
      </div>
    `,
  };

  try {
    // If we are in development and don't have real SMTP, we just log to console
    if (process.env.NODE_ENV === "development" && !process.env.SMTP_HOST) {
      console.log("-----------------------------------------");
      console.log("SIMULATED EMAIL NOTIFICATION");
      console.log(`To: ${recipientEmails.join(", ")}`);
      console.log(`Subject: ${mailOptions.subject}`);
      console.log(`Body: ${mailOptions.text}`);
      console.log("-----------------------------------------");
      return;
    }

    const info = await transporter.sendMail(mailOptions);
    console.log("Message sent: %s", info.messageId);
    if (process.env.NODE_ENV === "development") {
      console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    }
   } catch (error) {
    console.error("Error sending email:", error);
  }
}

export async function sendTaskThresholdNotification(data: {
  taskTitle: string;
  projectName: string;
  estimatedHours: string;
  actualHours: string;
  employeeName: string;
  recipientEmails: string[];
}) {
  const { taskTitle, projectName, estimatedHours, actualHours, employeeName, recipientEmails } = data;

  const mailOptions = {
    from: `"Logistics ERP System" <noreply@logisticserp.com>`,
    to: recipientEmails.join(", "),
    subject: `Task Time Limit Exceeded: ${taskTitle}`,
    text: `
      Hello,

      The timer for a task has exceeded its estimated duration.

      Project: ${projectName}
      Task: ${taskTitle}
      Estimated Hours: ${estimatedHours}
      Actual Hours Spent: ${actualHours}
      Assigned To: ${employeeName}

      Regards,
      Logistics ERP System
    `,
    html: `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #fee2e2; border-radius: 8px;">
        <h2 style="color: #dc2626;">Task Time Limit Exceeded</h2>
        <p>The timer for the following task has exceeded its estimated duration.</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Project:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${projectName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Task:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${taskTitle}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Estimated Hours:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${estimatedHours}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Actual Hours:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; color: #dc2626;"><strong>${actualHours}</strong></td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Assigned To:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${employeeName}</td>
          </tr>
        </table>
        <p style="margin-top: 20px;">Please review the task progress in the system.</p>
        <hr style="border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 12px; color: #777;">Regards,<br />Logistics ERP System</p>
      </div>
    `,
  };

  try {
    if (process.env.NODE_ENV === "development" && !process.env.SMTP_HOST) {
      console.log("-----------------------------------------");
      console.log("SIMULATED TASK THRESHOLD EMAIL");
      console.log(`To: ${recipientEmails.join(", ")}`);
      console.log(`Subject: ${mailOptions.subject}`);
      console.log(`Body: ${mailOptions.text}`);
      console.log("-----------------------------------------");
      return;
    }

    const info = await transporter.sendMail(mailOptions);
    console.log("Task threshold email sent: %s", info.messageId);
  } catch (error) {
    console.error("Error sending threshold email:", error);
  }
}
