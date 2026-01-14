import { Router } from "express";
import { 
  generateEngagementLetter, 
  generateForm9198, 
  signAgreement, 
  getAgreementsByEmployer,
  getAgreementById,
  sendAgreementForSignature,
  checkOnboardingDocumentsStatus
} from "../services/clientAgreements";
import { isAuthenticated } from "../replitAuth";

const router = Router();

router.post("/engagement-letter", isAuthenticated, async (req, res) => {
  try {
    const { employerId, signerName, signerTitle, signerEmail, feeStructure, feePercentage, flatFeeAmount, minimumFee, paymentTerms, contractDuration } = req.body;
    
    if (!employerId || !signerName || !signerTitle || !signerEmail) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const agreement = await generateEngagementLetter({
      employerId,
      signerName,
      signerTitle,
      signerEmail,
      feeStructure: feeStructure || "percentage",
      feePercentage: feePercentage || 25,
      flatFeeAmount,
      minimumFee,
      paymentTerms: paymentTerms || "upon_certification",
      contractDuration: contractDuration || "1_year",
    });

    res.json(agreement);
  } catch (error: any) {
    console.error("Error generating engagement letter:", error);
    res.status(500).json({ error: error.message || "Failed to generate engagement letter" });
  }
});

router.post("/form-9198", isAuthenticated, async (req, res) => {
  try {
    const { employerId, signerName, signerTitle, signerEmail, authorizationStartDate, authorizationEndDate } = req.body;
    
    if (!employerId || !signerName || !signerTitle || !signerEmail) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const agreement = await generateForm9198({
      employerId,
      signerName,
      signerTitle,
      signerEmail,
      authorizationStartDate: authorizationStartDate || new Date().toISOString().split('T')[0],
      authorizationEndDate,
    });

    res.json(agreement);
  } catch (error: any) {
    console.error("Error generating Form 9198:", error);
    res.status(500).json({ error: error.message || "Failed to generate Form 9198" });
  }
});

router.post("/:id/sign", isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { signatureData } = req.body;
    
    if (!signatureData) {
      return res.status(400).json({ error: "Signature data is required" });
    }

    const ipAddress = req.ip || req.connection.remoteAddress || "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";

    const agreement = await signAgreement(id, signatureData, ipAddress, userAgent);
    
    if (!agreement) {
      return res.status(404).json({ error: "Agreement not found" });
    }

    res.json(agreement);
  } catch (error: any) {
    console.error("Error signing agreement:", error);
    res.status(500).json({ error: error.message || "Failed to sign agreement" });
  }
});

router.post("/:id/send", isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const agreement = await sendAgreementForSignature(id);
    
    if (!agreement) {
      return res.status(404).json({ error: "Agreement not found" });
    }

    res.json(agreement);
  } catch (error: any) {
    console.error("Error sending agreement:", error);
    res.status(500).json({ error: error.message || "Failed to send agreement" });
  }
});

router.get("/employer/:employerId", isAuthenticated, async (req, res) => {
  try {
    const { employerId } = req.params;
    const agreements = await getAgreementsByEmployer(employerId);
    res.json(agreements);
  } catch (error: any) {
    console.error("Error fetching agreements:", error);
    res.status(500).json({ error: error.message || "Failed to fetch agreements" });
  }
});

router.get("/employer/:employerId/status", isAuthenticated, async (req, res) => {
  try {
    const { employerId } = req.params;
    const status = await checkOnboardingDocumentsStatus(employerId);
    res.json(status);
  } catch (error: any) {
    console.error("Error checking document status:", error);
    res.status(500).json({ error: error.message || "Failed to check document status" });
  }
});

router.get("/:id", isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const agreement = await getAgreementById(id);
    
    if (!agreement) {
      return res.status(404).json({ error: "Agreement not found" });
    }

    res.json(agreement);
  } catch (error: any) {
    console.error("Error fetching agreement:", error);
    res.status(500).json({ error: error.message || "Failed to fetch agreement" });
  }
});

export default router;
