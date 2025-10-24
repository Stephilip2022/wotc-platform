/**
 * Mock Texas WOTC Portal - For Testing Bot Automation
 * Simulates the real Texas portal interface for demonstration
 */

import { type Express } from "express";

export function registerDemoPortalRoutes(app: Express) {
  // Mock Texas Portal Login Page
  app.get("/demo/texas-portal", (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Texas Workforce Commission - WOTC OLS</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 500px; margin: 50px auto; padding: 20px; }
          h1 { color: #003366; }
          .login-form { background: #f5f5f5; padding: 30px; border-radius: 8px; }
          input { width: 100%; padding: 10px; margin: 10px 0; }
          button { background: #003366; color: white; padding: 12px 30px; border: none; cursor: pointer; width: 100%; }
          button:hover { background: #004080; }
        </style>
      </head>
      <body>
        <h1>Texas WOTC OLS Portal</h1>
        <div class="login-form">
          <h2>Login</h2>
          <form method="POST" action="/demo/texas-portal/login">
            <input type="text" name="username" id="username" placeholder="Username" required />
            <input type="password" name="password" id="password" placeholder="Password" required />
            <button type="submit">Login</button>
          </form>
        </div>
      </body>
      </html>
    `);
  });

  // Mock Texas Portal Dashboard
  app.post("/demo/texas-portal/login", (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>WOTC OLS - Dashboard</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
          .header { background: #003366; color: white; padding: 20px; }
          .nav { padding: 20px; background: #f0f0f0; }
          .content { padding: 40px; max-width: 800px; margin: 0 auto; }
          a { color: #003366; text-decoration: none; font-weight: bold; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Texas WOTC Online System</h1>
          <p>Welcome, Demo User</p>
        </div>
        <div class="nav">
          <a href="/demo/texas-portal/bulk-upload">Submit a Bulk File</a> |
          <a href="#">View Submissions</a> |
          <a href="#">Reports</a>
        </div>
        <div class="content">
          <h2>Dashboard</h2>
          <p>Select an option from the navigation menu above.</p>
        </div>
      </body>
      </html>
    `);
  });

  // Mock Bulk Upload Page
  app.get("/demo/texas-portal/bulk-upload", (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bulk File Upload</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; }
          .header { background: #003366; color: white; padding: 20px; }
          .content { padding: 40px; max-width: 800px; margin: 0 auto; }
          .upload-box { border: 2px dashed #ccc; padding: 40px; text-align: center; margin: 20px 0; }
          input[type="file"] { display: none; }
          .btn { background: #003366; color: white; padding: 12px 30px; border: none; cursor: pointer; margin: 10px; }
          .btn:hover { background: #004080; }
          .btn:disabled { background: #999; cursor: not-allowed; }
          #fileName { margin: 20px 0; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Bulk File Upload</h1>
        </div>
        <div class="content">
          <h2>Upload WOTC Certifications</h2>
          <p>Upload a CSV file containing employee WOTC certification data.</p>
          
          <form id="uploadForm" enctype="multipart/form-data">
            <div class="upload-box" onclick="document.getElementById('fileInput').click()">
              <p>Click to select CSV file</p>
              <p style="color: #666; font-size: 14px;">Supported format: .csv</p>
            </div>
            <input type="file" id="fileInput" accept=".csv" />
            <div id="fileName"></div>
            <button type="button" id="nextBtn" class="btn" disabled>NEXT</button>
          </form>
        </div>
        
        <script>
          const fileInput = document.getElementById('fileInput');
          const fileName = document.getElementById('fileName');
          const nextBtn = document.getElementById('nextBtn');
          
          fileInput.addEventListener('change', function(e) {
            if (e.target.files.length > 0) {
              fileName.textContent = 'Selected: ' + e.target.files[0].name;
              nextBtn.disabled = false;
              
              // Simulate file processing
              setTimeout(() => {
                window.location.href = '/demo/texas-portal/review';
              }, 1000);
            }
          });
        </script>
      </body>
      </html>
    `);
  });

  // Mock Review Page
  app.get("/demo/texas-portal/review", (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Review Submissions</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; }
          .header { background: #003366; color: white; padding: 20px; }
          .content { padding: 40px; max-width: 800px; margin: 0 auto; }
          .summary { background: #f0f0f0; padding: 20px; margin: 20px 0; }
          .checkbox-group { margin: 20px 0; }
          .checkbox-group label { display: block; margin: 10px 0; }
          .btn { background: #003366; color: white; padding: 12px 30px; border: none; cursor: pointer; margin: 10px 5px; }
          .btn:hover { background: #004080; }
          .success { color: green; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Review and Submit</h1>
        </div>
        <div class="content">
          <div class="summary">
            <h3>File Summary</h3>
            <p><strong>Total Records:</strong> 1</p>
            <p><strong>Valid Records:</strong> 1</p>
            <p><strong>Invalid Records:</strong> 0</p>
            <p class="success">✓ All records passed validation</p>
          </div>
          
          <h3>Electronic Agreement</h3>
          <div class="checkbox-group">
            <label>
              <input type="checkbox" id="agree1" />
              I certify that the information provided is accurate and complete
            </label>
            <label>
              <input type="checkbox" id="agree2" />
              I understand this is an electronic submission under Texas law
            </label>
          </div>
          
          <button class="btn" id="submitBtn" disabled onclick="submitForm()">SUBMIT</button>
        </div>
        
        <script>
          const agree1 = document.getElementById('agree1');
          const agree2 = document.getElementById('agree2');
          const submitBtn = document.getElementById('submitBtn');
          
          function checkAgreements() {
            submitBtn.disabled = !(agree1.checked && agree2.checked);
          }
          
          agree1.addEventListener('change', checkAgreements);
          agree2.addEventListener('change', checkAgreements);
          
          function submitForm() {
            window.location.href = '/demo/texas-portal/confirmation';
          }
        </script>
      </body>
      </html>
    `);
  });

  // Mock Confirmation Page
  app.get("/demo/texas-portal/confirmation", (req, res) => {
    const confirmationNumber = `TWC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const claimRange = `${100000 + Math.floor(Math.random() * 10000)} to ${100000 + Math.floor(Math.random() * 10000) + 100}`;
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Submission Confirmation</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; }
          .header { background: #003366; color: white; padding: 20px; }
          .content { padding: 40px; max-width: 800px; margin: 0 auto; text-align: center; }
          .success-box { background: #d4edda; border: 2px solid #28a745; padding: 30px; margin: 30px 0; border-radius: 8px; }
          .confirmation { font-size: 24px; color: #28a745; margin: 20px 0; }
          .details { text-align: left; margin: 30px auto; max-width: 500px; }
          .details p { margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Submission Successful</h1>
        </div>
        <div class="content">
          <div class="success-box">
            <h2>✓ Successfully Submitted</h2>
            <p class="confirmation">Confirmation Number: ${confirmationNumber}</p>
            <p>Claim Number Range: ${claimRange}</p>
          </div>
          
          <div class="details">
            <h3>Submission Details</h3>
            <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Total Applications:</strong> 1</p>
            <p><strong>Status:</strong> Processing</p>
            <p><strong>Expected Response:</strong> 30-45 days</p>
          </div>
          
          <p>You will receive determination letters via mail and email.</p>
        </div>
      </body>
      </html>
    `);
  });
}
