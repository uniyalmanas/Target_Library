"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { Library, SubscriptionRequest } from "@/lib/types";
import { getLibraryAccessStatus } from "@/lib/tenant";
import { downloadCsv } from "@/lib/exportCsv";
import { getStoredSession, setStoredSession, clearStoredSession, isSuperAdminAuthenticated, setSuperAdminMasterSession, impersonateTenantOwner } from "@/lib/auth";
import { generateUpiQrCodeUrl } from "@/lib/upi";
import LibraryLogo from "@/lib/LibraryLogo";

export default function SuperAdminPage() {
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // SuperAdmin Auth Gate State
  const [isSuperAdminAuth, setIsSuperAdminAuth] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [passcodeError, setPasscodeError] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  // Subscription Payment Verifications State
  const [subRequests, setSubRequests] = useState<SubscriptionRequest[]>([]);
  const [loadingSubRequests, setLoadingSubRequests] = useState(false);
  const [selectedScreenshot, setSelectedScreenshot] = useState<{ url: string; title: string } | null>(null);
  const [processingReqId, setProcessingReqId] = useState<string | null>(null);
  const [rejectModalReq, setRejectModalReq] = useState<SubscriptionRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRequestsHistory, setShowRequestsHistory] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "trial" | "locked" | "vip">("all");
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // New Library Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    city: "Dehradun",
    phone: "",
    address: "",
    total_seats: 50,
    monthly_fee: 600,
    upi_id: "",
    owner_password: "OwnerPass2026",
    staff_password: "StaffPass2026",
  });

  // Edit Pricing Modal State
  const [editingLibrary, setEditingLibrary] = useState<Library | null>(null);
  const [newFee, setNewFee] = useState<number>(600);
  const [isLifetimeFixed, setIsLifetimeFixed] = useState<boolean>(false);

  // Password Management & Ghost Mode Modal State
  const [passwordModalLib, setPasswordModalLib] = useState<Library | null>(null);
  const [newOwnerPassword, setNewOwnerPassword] = useState("");
  const [newStaffPassword, setNewStaffPassword] = useState("");
  const [updatingOwnerPass, setUpdatingOwnerPass] = useState(false);
  const [updatingStaffPass, setUpdatingStaffPass] = useState(false);
  const [passwordActionFeedback, setPasswordActionFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Founder SaaS Receiver UPI Configuration State
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [platformUpiId, setPlatformUpiId] = useState("uniyalmanas@oksbi");
  const [platformUpiName, setPlatformUpiName] = useState("Manas Uniyal");
  const [platformPhone, setPlatformPhone] = useState("8535035757");
  const [savingUpi, setSavingUpi] = useState(false);
  const [upiSaveFeedback, setUpiSaveFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Founder SaaS Platform Logo State
  const [platformLogo, setPlatformLogo] = useState("/libraryos-logo.png");
  const [showPlatformLogoModal, setShowPlatformLogoModal] = useState(false);
  const [newPlatformLogoPreview, setNewPlatformLogoPreview] = useState<string | null>(null);
  const [platformLogoFileSize, setPlatformLogoFileSize] = useState<string | null>(null);
  const [savingPlatformLogo, setSavingPlatformLogo] = useState(false);
  const [platformLogoFeedback, setPlatformLogoFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const platformLogoInputRef = useRef<HTMLInputElement | null>(null);

  // Library Logo Modal State
  const [logoModalLib, setLogoModalLib] = useState<Library | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFileSize, setLogoFileSize] = useState<string | null>(null);
  const [savingLogo, setSavingLogo] = useState(false);
  const [logoActionFeedback, setLogoActionFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const libraryLogoInputRef = useRef<HTMLInputElement | null>(null);

  // Process image file via HTML5 Canvas into compact WebP Base64 string (< 30KB)
  const processImageFile = (file: File): Promise<{ dataUrl: string; sizeKb: number }> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) {
        reject(new Error("Please select an image file (PNG, JPG, WebP, SVG)."));
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const maxDim = 256;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Canvas context could not be created."));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/webp", 0.88);
          const approxSizeKb = Math.round(((compressed.length * 0.75) / 1024) * 10) / 10;
          resolve({ dataUrl: compressed, sizeKb: approxSizeKb });
        };
        img.onerror = () => reject(new Error("Failed to load image."));
        img.src = event.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read file."));
      reader.readAsDataURL(file);
    });
  };

  const fetchPlatformConfig = async () => {
    try {
      const res = await fetch("/api/platform-config");
      const data = await res.json();
      if (res.ok && data) {
        if (data.upi_id) setPlatformUpiId(data.upi_id);
        if (data.upi_name) setPlatformUpiName(data.upi_name);
        if (data.phone) setPlatformPhone(data.phone);
        if (data.logo_url) setPlatformLogo(data.logo_url);
      }
    } catch {
      // Fallback
    }
  };

  const handleSavePlatformUpi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!platformUpiId.trim()) {
      setUpiSaveFeedback({ type: "error", message: "A valid UPI ID is required (e.g. uniyalmanas@oksbi)." });
      return;
    }
    setSavingUpi(true);
    setUpiSaveFeedback(null);
    try {
      const res = await fetch("/api/platform-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          upi_id: platformUpiId.trim(),
          upi_name: platformUpiName.trim(),
          phone: platformPhone.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setUpiSaveFeedback({
          type: "success",
          message: "Receiver UPI settings updated! All payment QR codes, modal popups, and lock barriers across all libraries now receive payments at this UPI ID.",
        });
        setTimeout(() => {
          setUpiSaveFeedback(null);
          setShowUpiModal(false);
        }, 2200);
      } else {
        setUpiSaveFeedback({ type: "error", message: data.error || "Failed to save UPI settings." });
      }
    } catch (err: unknown) {
      setUpiSaveFeedback({ type: "error", message: err instanceof Error ? err.message : "Network error" });
    } finally {
      setSavingUpi(false);
    }
  };

  const handlePlatformLogoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { dataUrl, sizeKb } = await processImageFile(file);
      setNewPlatformLogoPreview(dataUrl);
      setPlatformLogoFileSize(`${sizeKb} KB (WebP)`);
      setPlatformLogoFeedback(null);
    } catch (err: unknown) {
      setPlatformLogoFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to process logo image",
      });
    }
  };

  const handleSavePlatformLogo = async () => {
    setSavingPlatformLogo(true);
    setPlatformLogoFeedback(null);
    try {
      const res = await fetch("/api/platform-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logo_url: newPlatformLogoPreview || "/libraryos-logo.png",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save platform logo");

      setPlatformLogo(newPlatformLogoPreview || "/libraryos-logo.png");
      setPlatformLogoFeedback({
        type: "success",
        message: "Platform logo updated successfully! All platform views and prompts now display the new logo.",
      });

      setTimeout(() => {
        setPlatformLogoFeedback(null);
        setShowPlatformLogoModal(false);
      }, 1500);
    } catch (err: unknown) {
      setPlatformLogoFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to update platform logo",
      });
    } finally {
      setSavingPlatformLogo(false);
    }
  };

  const handleOpenLogoModal = (lib: Library) => {
    setLogoModalLib(lib);
    setLogoPreview(lib.logo_url || null);
    setLogoFileSize(null);
    setLogoActionFeedback(null);
  };

  const handleLibraryLogoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { dataUrl, sizeKb } = await processImageFile(file);
      setLogoPreview(dataUrl);
      setLogoFileSize(`${sizeKb} KB (WebP)`);
      setLogoActionFeedback(null);
    } catch (err: unknown) {
      setLogoActionFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to process logo image",
      });
    }
  };

  const handleSaveLibraryLogo = async () => {
    if (!logoModalLib) return;
    setSavingLogo(true);
    setLogoActionFeedback(null);
    try {
      const res = await fetch("/api/libraries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: logoModalLib.id,
          logo_url: logoPreview || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update logo");

      // Also ensure library_settings is synchronized
      try {
        await fetch(`/api/libraries/${logoModalLib.slug}/settings`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            logo_url: logoPreview || null,
          }),
        });
      } catch {
        // safe fallback
      }

      // Update local state immediately
      setLibraries((prev) =>
        prev.map((l) =>
          l.id === logoModalLib.id ? { ...l, logo_url: logoPreview || null } : l
        )
      );

      setLogoActionFeedback({
        type: "success",
        message: `Logo updated successfully for ${logoModalLib.name}! Passes, receipts, and headers are live.`,
      });

      setTimeout(() => {
        setLogoActionFeedback(null);
        setLogoModalLib(null);
      }, 1500);
    } catch (err: unknown) {
      setLogoActionFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Error saving logo",
      });
    } finally {
      setSavingLogo(false);
    }
  };

  const fetchLibraries = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/libraries?all=true");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load libraries");
      setLibraries(data.libraries || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error fetching libraries");
    } finally {
      setLoading(false);
    }
  };

  const fetchSubRequests = async () => {
    setLoadingSubRequests(true);
    try {
      const res = await fetch("/api/subscription-requests?all=true");
      const data = await res.json();
      if (res.ok) {
        setSubRequests(data.requests || []);
      }
    } catch {
      // Ignore network errors
    } finally {
      setLoadingSubRequests(false);
    }
  };

  // Verify Founder Passcode Session
  useEffect(() => {
    if (isSuperAdminAuthenticated()) {
      setSuperAdminMasterSession(true);
      setIsSuperAdminAuth(true);
      fetchLibraries();
      fetchSubRequests();
      fetchPlatformConfig();
    } else {
      setIsSuperAdminAuth(false);
      setLoading(false);
    }
    setCheckingAuth(false);
  }, []);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcodeInput.trim()) {
      setPasscodeError("Please enter founder master passcode.");
      return;
    }
    setUnlocking(true);
    setPasscodeError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "superadmin",
          password: passcodeInput.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuperAdminMasterSession(true);
        setStoredSession({
          role: "superadmin",
          username: "founder",
          fullName: "SaaS Platform Founder",
          isMaster: true,
        });
        setIsSuperAdminAuth(true);
        fetchLibraries();
        fetchSubRequests();
        fetchPlatformConfig();
      } else {
        setPasscodeError(data.error || "Incorrect founder passcode. Access denied.");
      }
    } catch {
      setPasscodeError("Authentication service error. Please try again.");
    } finally {
      setUnlocking(false);
    }
  };

  const handleLock = () => {
    setSuperAdminMasterSession(false);
    clearStoredSession();
    setIsSuperAdminAuth(false);
    setPasscodeInput("");
  };

  const handleMasterLogin = (lib: Library, targetPath: string = "") => {
    impersonateTenantOwner(lib.slug, lib.name, lib.id);
    const dest = targetPath ? `/l/${lib.slug}/${targetPath}` : `/l/${lib.slug}`;
    window.open(dest, "_blank");
  };

  const handleOpenPasswordModal = (lib: Library) => {
    setPasswordModalLib(lib);
    setNewOwnerPassword("");
    setNewStaffPassword("");
    setPasswordActionFeedback(null);
  };

  const handleUpdatePassword = async (role: "owner" | "staff") => {
    if (!passwordModalLib) return;
    const pwd = role === "owner" ? newOwnerPassword : newStaffPassword;
    if (!pwd.trim()) {
      setPasswordActionFeedback({
        type: "error",
        message: `Please enter a new ${role} password.`,
      });
      return;
    }

    if (role === "owner") setUpdatingOwnerPass(true);
    else setUpdatingStaffPass(true);
    setPasswordActionFeedback(null);

    try {
      const res = await fetch(`/api/libraries/${passwordModalLib.slug}/staff-password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_role: role,
          new_password: pwd.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update password");

      setPasswordActionFeedback({
        type: "success",
        message: `Successfully reset ${role === "owner" ? "Owner" : "Staff"} password for ${passwordModalLib.name}!`,
      });
      if (role === "owner") setNewOwnerPassword("");
      else setNewStaffPassword("");
    } catch (err: unknown) {
      setPasswordActionFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to update password",
      });
    } finally {
      if (role === "owner") setUpdatingOwnerPass(false);
      else setUpdatingStaffPass(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopyFeedback(`Copied ${label}!`);
      setTimeout(() => setCopyFeedback(null), 2500);
    }
  };

  // Subscription Requests Approval & Rejection Handlers
  const handleApproveSubRequest = async (req: SubscriptionRequest) => {
    const confirmApprove = window.confirm(
      `Approve payment of ₹${req.amount} for ${req.library_name}? This will activate their subscription for ${req.billing_period_days || 30} days.`
    );
    if (!confirmApprove) return;

    setProcessingReqId(req.id);
    try {
      const res = await fetch("/api/subscription-requests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: req.id,
          action: "approve",
          reviewed_by: "Founder Admin",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to approve request");

      alert(data.message || "Payment verified and subscription activated!");
      fetchSubRequests();
      fetchLibraries();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error approving payment");
    } finally {
      setProcessingReqId(null);
    }
  };

  const handleRejectSubRequest = async () => {
    if (!rejectModalReq) return;
    if (!rejectionReason.trim()) {
      alert("Please provide a reason for rejecting this payment submission.");
      return;
    }

    setProcessingReqId(rejectModalReq.id);
    try {
      const res = await fetch("/api/subscription-requests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: rejectModalReq.id,
          action: "reject",
          rejection_reason: rejectionReason.trim(),
          reviewed_by: "Founder Admin",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reject request");

      setRejectModalReq(null);
      setRejectionReason("");
      fetchSubRequests();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error rejecting payment");
    } finally {
      setProcessingReqId(null);
    }
  };

  // Pending Subscription Requests Memo
  const pendingSubRequests = useMemo(() => {
    return subRequests.filter((r) => r.status === "pending");
  }, [subRequests]);

  // Stats Calculations: Only count verified paid active subscriptions toward MRR
  // Free 7-day trials (like testing-library-1) have NOT paid fees and do not inflate MRR!
  const stats = useMemo(() => {
    const total = libraries.length;

    const paidActiveLibs = libraries.filter((l) => {
      if (l.is_lifetime_fixed) return true;
      if (l.subscription_status === "active") {
        if (!l.subscription_ends_at) return true;
        return new Date(l.subscription_ends_at).getTime() > Date.now();
      }
      return false;
    });

    const mrr = paidActiveLibs.reduce((sum, l) => sum + (l.monthly_fee || 0), 0);
    const activePaidCount = paidActiveLibs.length;

    const trialLibs = libraries.filter((l) => {
      const access = getLibraryAccessStatus(l);
      return access.status === "trial" && !access.isBlocked;
    });

    const blockedLibs = libraries.filter((l) => {
      const access = getLibraryAccessStatus(l);
      return access.isBlocked;
    });

    const foundingVips = libraries.filter((l) => l.is_lifetime_fixed).length;

    const totalSeats = libraries.reduce((sum, l) => {
      return sum + ((l as any).library_settings?.total_seats || 50);
    }, 0);

    return {
      total,
      activePaidCount,
      trialCount: trialLibs.length,
      blockedCount: blockedLibs.length,
      mrr,
      foundingVips,
      totalSeats,
    };
  }, [libraries]);

  // Filtered & Searched Libraries
  const filteredLibraries = useMemo(() => {
    return libraries.filter((lib) => {
      const access = getLibraryAccessStatus(lib);

      // Status Filter
      if (statusFilter === "active" && access.status !== "active" && !lib.is_lifetime_fixed) return false;
      if (statusFilter === "trial" && access.status !== "trial") return false;
      if (statusFilter === "locked" && !access.isBlocked) return false;
      if (statusFilter === "vip" && !lib.is_lifetime_fixed) return false;

      // Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = lib.name.toLowerCase().includes(q);
        const slugMatch = lib.slug.toLowerCase().includes(q);
        const cityMatch = (lib.city || "").toLowerCase().includes(q);
        const phoneMatch = (lib.phone || "").toLowerCase().includes(q);
        const upiMatch = (lib.upi_id || "").toLowerCase().includes(q);
        if (!nameMatch && !slugMatch && !cityMatch && !phoneMatch && !upiMatch) return false;
      }
      return true;
    });
  }, [libraries, statusFilter, searchQuery]);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showAddModal) setShowAddModal(false);
        if (showUpiModal) setShowUpiModal(false);
        if (showPlatformLogoModal) setShowPlatformLogoModal(false);
        if (logoModalLib) setLogoModalLib(null);
        if (passwordModalLib) setPasswordModalLib(null);
        if (editingLibrary) setEditingLibrary(null);
        if (selectedScreenshot) setSelectedScreenshot(null);
        if (rejectModalReq) setRejectModalReq(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showAddModal, showUpiModal, showPlatformLogoModal, logoModalLib, passwordModalLib, editingLibrary, selectedScreenshot, rejectModalReq]);

  // Handle Slug Auto-generation
  const handleNameChange = (name: string) => {
    const generatedSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");
    setFormData((prev) => ({ ...prev, name, slug: generatedSlug }));
  };

  // Create Library
  const handleCreateLibrary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.slug) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/libraries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create library");

      setShowAddModal(false);
      setFormData({
        name: "",
        slug: "",
        city: "Dehradun",
        phone: "",
        address: "",
        total_seats: 50,
        monthly_fee: 600,
        upi_id: "",
        owner_password: "OwnerPass2026",
        staff_password: "StaffPass2026",
      });
      fetchLibraries();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error creating library");
    } finally {
      setSubmitting(false);
    }
  };

  // Update Library Pricing / Status
  const handleSavePrice = async () => {
    if (!editingLibrary) return;
    try {
      const res = await fetch("/api/libraries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingLibrary.id,
          monthly_fee: newFee,
          is_lifetime_fixed: isLifetimeFixed,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update price");
      setEditingLibrary(null);
      fetchLibraries();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error updating price");
    }
  };

  // Quick 1-Month Extension (When owner pays via UPI)
  const handleExtendMonth = async (lib: Library) => {
    const confirmExtend = window.confirm(
      `Mark subscription as paid for ${lib.name}? This will extend their access by 30 days.`
    );
    if (!confirmExtend) return;

    try {
      const currentExpiry = lib.subscription_ends_at ? new Date(lib.subscription_ends_at) : new Date();
      const newExpiry = new Date(Math.max(currentExpiry.getTime(), Date.now()) + 30 * 24 * 60 * 60 * 1000);

      const res = await fetch("/api/libraries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: lib.id,
          subscription_status: "active",
          subscription_ends_at: newExpiry.toISOString(),
          trial_ends_at: null,
        }),
      });
      if (!res.ok) throw new Error("Failed to extend subscription");
      fetchLibraries();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error extending subscription");
    }
  };

  // Extend or Reset Free Trial
  const handleExtendTrial = async (lib: Library, days: number = 7) => {
    const confirmExtend = window.confirm(
      `Extend free trial for ${lib.name} by ${days} days? Access will remain open and fee unpaid.`
    );
    if (!confirmExtend) return;

    try {
      const newTrialEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      const res = await fetch("/api/libraries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: lib.id,
          subscription_status: "trial",
          trial_ends_at: newTrialEnd,
          subscription_ends_at: null,
        }),
      });
      if (!res.ok) throw new Error("Failed to extend trial");
      fetchLibraries();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error extending trial");
    }
  };

  // Simulate Trial Expiry (To test locked paywall barrier while preserving data)
  const handleExpireTrial = async (lib: Library) => {
    const confirmExpire = window.confirm(
      `Simulate trial expiry for ${lib.name}? This will instantly lock the workspace behind the renewal barrier (All data is 100% preserved).`
    );
    if (!confirmExpire) return;

    try {
      const pastTime = new Date(Date.now() - 60 * 1000).toISOString();
      const res = await fetch("/api/libraries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: lib.id,
          subscription_status: "trial",
          trial_ends_at: pastTime,
          subscription_ends_at: null,
        }),
      });
      if (!res.ok) throw new Error("Failed to expire trial");
      fetchLibraries();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error expiring trial");
    }
  };

  // Export Tenants Directory to CSV
  const handleExportLibrariesCSV = () => {
    if (!libraries.length) {
      alert("No tenant libraries to export.");
      return;
    }

    const headers = [
      "Library ID",
      "Library Name",
      "Workspace Slug",
      "Workspace URL",
      "City",
      "Phone Number",
      "Soundbox UPI ID",
      "Monthly Fee (₹)",
      "Subscription Status",
      "Access Phase",
      "Trial End Date",
      "Subscription End Date",
      "Lifetime VIP",
      "Total Seats",
      "Onboarded Date",
    ];

    const rows = libraries.map((lib) => {
      const access = getLibraryAccessStatus(lib);
      return [
        lib.id,
        lib.name,
        lib.slug,
        `/l/${lib.slug}`,
        lib.city || "Dehradun",
        lib.phone ? `="${lib.phone}"` : "",
        lib.upi_id || "",
        lib.monthly_fee,
        lib.subscription_status,
        access.status,
        lib.trial_ends_at || "N/A",
        lib.subscription_ends_at || "N/A",
        lib.is_lifetime_fixed ? "Yes (VIP)" : "No",
        (lib as any).library_settings?.total_seats || 50,
        lib.created_at ? lib.created_at.split("T")[0] : "",
      ];
    });

    const today = new Date().toISOString().split("T")[0];
    downloadCsv({
      filename: `LibraryOS_Tenants_Directory_${today}.csv`,
      headers,
      rows,
    });
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isSuperAdminAuth) {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="bg-card-bg border border-panel-border rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-5 text-center animate-in zoom-in-95">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center text-3xl mx-auto shadow-inner">
            🛡️
          </div>

          <div>
            <h1 className="text-xl font-black text-text-main tracking-tight">
              Founder Master Key Required
            </h1>
            <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
              The SuperAdmin panel controls global SaaS tenant provisioning, subscription locks, MRR telemetry, and confidential library contact ledgers.
            </p>
          </div>

          {passcodeError && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
              <span>⚠️</span> {passcodeError}
            </div>
          )}

          <form onSubmit={handleUnlock} className="space-y-4 text-left pt-1">
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted block">
                Enter Founder Master Passcode
              </label>
              <input
                type="password"
                required
                autoFocus
                placeholder="Enter founder master passcode..."
                value={passcodeInput}
                onChange={(e) => setPasscodeInput(e.target.value)}
                className="w-full bg-background border border-panel-border rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={unlocking || !passcodeInput.trim()}
              className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs shadow-sm transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {unlocking ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Verifying Founder Key...
                </>
              ) : (
                <>Unlock Founder Panel &rarr;</>
              )}
            </button>
          </form>

          <div className="pt-3 border-t border-panel-border text-center">
            <Link href="/" className="text-xs font-bold text-text-muted hover:text-text-main transition">
              &larr; Return to SaaS Homepage
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-text-main pb-24 pt-8 px-4 md:px-8 w-full max-w-[96vw] 2xl:max-w-[1750px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-panel-border pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="relative group shrink-0">
              <img
                src={platformLogo || "/libraryos-logo.png"}
                alt="Platform Logo"
                className="w-10 h-10 rounded-2xl object-contain border border-panel-border shadow-xs bg-card-bg p-1 shrink-0 cursor-pointer group-hover:opacity-90 transition"
                onClick={() => {
                  setPlatformLogoFeedback(null);
                  setNewPlatformLogoPreview(platformLogo);
                  setPlatformLogoFileSize(null);
                  setShowPlatformLogoModal(true);
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = "/libraryos-logo.png";
                }}
              />
              <button
                onClick={() => {
                  setPlatformLogoFeedback(null);
                  setNewPlatformLogoPreview(platformLogo);
                  setPlatformLogoFileSize(null);
                  setShowPlatformLogoModal(true);
                }}
                className="absolute inset-0 bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs text-white transition cursor-pointer"
                title="Change SaaS Platform Logo"
              >
                ✏️
              </button>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                SaaS Founder Control Panel
              </h1>
              <p className="text-xs text-text-muted mt-0.5">
                Centralized management for all subscribed study libraries and reading rooms.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href="/"
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-card-bg border border-panel-border hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer text-text-muted hover:text-text-main"
          >
            ← SaaS Home
          </Link>
          <button
            onClick={() => {
              fetchLibraries();
              fetchSubRequests();
            }}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-card-bg border border-panel-border hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
          >
            🔄 Refresh
          </button>
          <button
            onClick={handleExportLibrariesCSV}
            disabled={!libraries.length}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-card-bg border border-panel-border hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer flex items-center gap-1 text-text-main"
            title="Download full client directory as CSV"
          >
            <span>📥</span> Export Tenants CSV
          </button>
          <button
            onClick={() => {
              setPlatformLogoFeedback(null);
              setNewPlatformLogoPreview(platformLogo);
              setPlatformLogoFileSize(null);
              setShowPlatformLogoModal(true);
            }}
            className="px-3.5 py-2 text-xs font-bold rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Change SaaS Platform Brand Logo"
          >
            <span>🖼️</span> Platform Logo
          </button>
          <button
            onClick={() => {
              setUpiSaveFeedback(null);
              fetchPlatformConfig();
              setShowUpiModal(true);
            }}
            className="px-3.5 py-2 text-xs font-bold rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Configure Receiver UPI ID for SaaS Subscriptions"
          >
            <span>💳</span> SaaS UPI Settings
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition flex items-center gap-1.5 cursor-pointer"
          >
            <span>+</span> Onboard New Library
          </button>
          <button
            onClick={handleLock}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-card-bg border border-panel-border hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer text-rose-600 dark:text-rose-400 flex items-center gap-1"
            title="Lock Founder Session"
          >
            <span>🔒</span> Lock Panel
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 my-6">
        <div className="bg-card-bg border border-panel-border rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-medium text-text-muted uppercase tracking-wider">
            Total Subscribed Libraries
          </div>
          <div className="text-3xl font-black mt-1 text-text-main">{stats.total}</div>
          <div className="text-[11px] text-text-muted mt-1">
            {stats.activePaidCount} paying • {stats.trialCount} on trial
          </div>
        </div>

        <div className="bg-card-bg border border-emerald-500/20 bg-emerald-500/5 rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center justify-between">
            <span>Verified Paid MRR</span>
            <span>💰</span>
          </div>
          <div className="text-3xl font-black mt-1 text-emerald-600 dark:text-emerald-400">
            ₹{stats.mrr.toLocaleString("en-IN")}/mo
          </div>
          <div className="text-[11px] text-emerald-600/70 dark:text-emerald-400/70 mt-1">
            Annual: ₹{(stats.mrr * 12).toLocaleString("en-IN")}/yr (Trials ₹0)
          </div>
        </div>

        <div className="bg-card-bg border border-amber-500/20 bg-amber-500/5 rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center justify-between">
            <span>Testing / 7-Day Trials</span>
            <span>🧪</span>
          </div>
          <div className="text-3xl font-black mt-1 text-amber-600 dark:text-amber-400">
            {stats.trialCount}
          </div>
          <div className="text-[11px] text-amber-600/70 dark:text-amber-400/70 mt-1">
            Unpaid testing phase
          </div>
        </div>

        <div className="bg-card-bg border border-panel-border rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-medium text-text-muted uppercase tracking-wider flex items-center justify-between">
            <span>Blocked / Expired</span>
            <span>🔒</span>
          </div>
          <div className="text-3xl font-black mt-1 text-rose-600 dark:text-rose-400">
            {stats.blockedCount}
          </div>
          <div className="text-[11px] text-text-muted mt-1">Data safely preserved</div>
        </div>
      </div>

      {/* Pending Payment Verifications Section */}
      {pendingSubRequests.length > 0 && (
        <div className="my-6 p-5 rounded-3xl bg-amber-500/10 border-2 border-amber-500/40 shadow-lg space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="text-2xl p-2.5 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                🔔
              </span>
              <div>
                <h2 className="text-base font-black text-foreground flex items-center gap-2">
                  <span>Pending Subscription Payment Verifications</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-500 text-black">
                    {pendingSubRequests.length} Waiting
                  </span>
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Library owners have uploaded UPI payment screenshots. Verify the transaction and approve with 1 click.
                </p>
              </div>
            </div>
            <button
              onClick={fetchSubRequests}
              className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
            >
              🔄 Refresh Queue
            </button>
          </div>

          {/* List of Pending Requests */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingSubRequests.map((req) => (
              <div
                key={req.id}
                className="bg-card-bg border border-amber-500/30 rounded-2xl p-4 shadow-sm space-y-3.5 flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-extrabold text-sm text-foreground flex items-center gap-1.5">
                        <span>📚</span> {req.library_name}
                      </h3>
                      <Link
                        href={`/l/${encodeURIComponent(req.library_slug)}`}
                        target="_blank"
                        className="text-[11px] text-text-muted hover:text-rose-500 font-mono transition inline-block"
                      >
                        /l/{req.library_slug} ↗
                      </Link>
                    </div>
                    <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      ₹{req.amount}
                    </span>
                  </div>

                  <div className="text-xs space-y-1 text-text-muted">
                    <div className="flex justify-between">
                      <span>Plan:</span>
                      <span className="font-semibold text-foreground">{req.plan_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Submitted:</span>
                      <span>{new Date(req.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</span>
                    </div>
                    {req.utr_number && (
                      <div className="flex justify-between">
                        <span>UTR / Ref:</span>
                        <span className="font-mono font-bold text-foreground">{req.utr_number}</span>
                      </div>
                    )}
                    {req.notes && (
                      <div className="text-[11px] italic bg-neutral-500/5 p-2 rounded-lg border border-panel-border mt-1">
                        &ldquo;{req.notes}&rdquo;
                      </div>
                    )}
                  </div>

                  {/* Screenshot Thumbnail Preview */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedScreenshot({
                          url: req.screenshot_url,
                          title: `${req.library_name} — ₹${req.amount} Payment Screenshot`,
                        })
                      }
                      className="w-full relative group rounded-xl overflow-hidden border border-panel-border bg-neutral-900/10 hover:border-amber-500/50 transition cursor-pointer"
                    >
                      <img
                        src={req.screenshot_url}
                        alt="Payment Receipt Screenshot"
                        className="w-full h-32 object-cover object-top"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold gap-1.5">
                        <span>🔍</span> Click to Inspect Screenshot
                      </div>
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-panel-border">
                  <button
                    onClick={() => handleApproveSubRequest(req)}
                    disabled={processingReqId === req.id}
                    className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-sm transition active:scale-95 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <span>{processingReqId === req.id ? "⏳" : "✓"}</span> Approve (+30d)
                  </button>
                  <button
                    onClick={() => {
                      setRejectModalReq(req);
                      setRejectionReason("");
                    }}
                    disabled={processingReqId === req.id}
                    className="py-2.5 px-3 rounded-xl bg-card-bg border border-rose-500/30 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-xs transition active:scale-95 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <span>✕</span> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Status Filter Toolbar */}
      <div className="bg-card-bg border border-panel-border rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 my-6">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-xs select-none">
            🔍
          </span>
          <input
            type="text"
            placeholder="Search by name, slug, phone, city, or UPI..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background border border-panel-border rounded-xl pl-9 pr-8 py-2 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted hover:text-text-main cursor-pointer"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              statusFilter === "all"
                ? "bg-rose-600 text-white shadow-2xs"
                : "bg-background border border-panel-border text-text-muted hover:text-text-main"
            }`}
          >
            All ({stats.total})
          </button>
          <button
            onClick={() => setStatusFilter("active")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              statusFilter === "active"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "bg-background border border-panel-border text-text-muted hover:text-text-main"
            }`}
          >
            🟢 Active ({stats.activePaidCount})
          </button>
          <button
            onClick={() => setStatusFilter("trial")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              statusFilter === "trial"
                ? "bg-amber-600 text-white shadow-2xs"
                : "bg-background border border-panel-border text-text-muted hover:text-text-main"
            }`}
          >
            🟡 Trials ({stats.trialCount})
          </button>
          <button
            onClick={() => setStatusFilter("locked")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              statusFilter === "locked"
                ? "bg-rose-600 text-white shadow-2xs"
                : "bg-background border border-panel-border text-text-muted hover:text-text-main"
            }`}
          >
            🔴 Locked ({stats.blockedCount})
          </button>
          <button
            onClick={() => setStatusFilter("vip")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              statusFilter === "vip"
                ? "bg-amber-600 text-white shadow-2xs"
                : "bg-background border border-panel-border text-text-muted hover:text-text-main"
            }`}
          >
            ⭐ VIP ({stats.foundingVips})
          </button>
        </div>
      </div>

      {/* Libraries Table */}
      {loading ? (
        <div className="bg-card-bg border border-panel-border rounded-2xl p-16 text-center shadow-sm">
          <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs text-text-muted font-medium">Loading subscribed libraries...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-6 text-center text-rose-600 dark:text-rose-400 text-xs">
          {error}
        </div>
      ) : (
        <div className="bg-card-bg border border-panel-border rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-panel-border flex items-center justify-between">
            <h2 className="font-bold text-sm text-text-main">Tenant Libraries Directory</h2>
            <span className="text-xs text-text-muted">
              Showing {filteredLibraries.length} of {libraries.length} registered
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-panel-border bg-neutral-500/5 text-text-muted font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Library Name</th>
                  <th className="py-3.5 px-4">Slug / URL</th>
                  <th className="py-3.5 px-4">City</th>
                  <th className="py-3.5 px-4">Monthly Rate</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-panel-border">
                {filteredLibraries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-text-muted">
                      No libraries matching &quot;{searchQuery}&quot;
                    </td>
                  </tr>
                ) : (
                  filteredLibraries.map((lib) => {
                    const access = getLibraryAccessStatus(lib);

                    return (
                      <tr key={lib.id} className="hover:bg-neutral-500/5 transition-colors">
                        {/* Name */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="relative group shrink-0">
                              <LibraryLogo
                                slug={lib.slug}
                                logoUrl={lib.logo_url}
                                name={lib.name}
                                size="md"
                                className="border border-panel-border shadow-2xs"
                              />
                              <button
                                onClick={() => handleOpenLogoModal(lib)}
                                className="absolute inset-0 bg-black/60 rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] text-white transition cursor-pointer"
                                title="Change logo for this library"
                              >
                                ✏️
                              </button>
                            </div>
                            <div>
                              <div className="font-bold text-text-main text-sm flex items-center gap-2">
                                {lib.name}
                                {lib.is_lifetime_fixed && (
                                  <span className="text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded font-bold">
                                    ⭐ Founding VIP
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-text-muted mt-0.5">
                                📞 {lib.phone || "No phone"} • UPI: {lib.upi_id || "None"}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Slug */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <code className="bg-neutral-500/10 px-2 py-1 rounded text-[11px] font-mono font-semibold text-rose-600 dark:text-rose-400">
                              /l/{lib.slug}
                            </code>
                            <button
                              onClick={() => handleCopy(`/l/${lib.slug}`, `${lib.name} slug`)}
                              className="p-1 rounded hover:bg-neutral-500/10 text-text-muted hover:text-text-main transition text-xs cursor-pointer"
                              title="Copy URL slug"
                            >
                              📋
                            </button>
                          </div>
                        </td>

                        {/* City */}
                        <td className="py-3.5 px-4 whitespace-nowrap font-medium text-text-main">
                          📍 {lib.city || "Dehradun"}
                        </td>

                        {/* Monthly Rate */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {access.status === "trial" ? (
                            <div>
                              <span className="font-extrabold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md text-xs inline-block">
                                ₹0 (Free Trial)
                              </span>
                              <div className="text-[10px] text-text-muted mt-0.5">
                                ₹{lib.monthly_fee}/mo due {lib.trial_ends_at ? new Date(lib.trial_ends_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : "7 days"}
                              </div>
                            </div>
                          ) : access.isBlocked ? (
                            <div>
                              <span className="font-extrabold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md text-xs inline-block">
                                Unpaid (Locked)
                              </span>
                              <div className="text-[10px] text-text-muted mt-0.5">
                                Rate: ₹{lib.monthly_fee}/mo
                              </div>
                            </div>
                          ) : (
                            <div>
                              <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                                ₹{lib.monthly_fee}/mo
                              </span>
                              <div className="text-[10px] text-emerald-600/80">
                                {lib.is_lifetime_fixed ? "⭐ Founding VIP" : "Verified Paid"}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {lib.is_lifetime_fixed ? (
                            <span className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-[11px] font-bold px-2 py-0.5 rounded-full">
                              <span>⭐</span> LIFETIME VIP
                            </span>
                          ) : access.status === "trial" ? (
                            <span className="inline-flex items-center gap-1.5 bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                              🟡 7-DAY TRIAL ({access.trialDaysRemaining}d left)
                            </span>
                          ) : access.status === "trial_expired" ? (
                            <span className="inline-flex items-center gap-1 bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                              🔴 TRIAL EXPIRED (LOCKED)
                            </span>
                          ) : access.status === "past_due" ? (
                            <span className="inline-flex items-center gap-1 bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                              🔴 PAST DUE (LOCKED)
                            </span>
                          ) : access.status === "suspended" ? (
                            <span className="inline-flex items-center gap-1 bg-neutral-500/15 text-neutral-600 dark:text-neutral-400 border border-neutral-500/30 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-neutral-500"></span>
                              SUSPENDED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              🟢 ACTIVE
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <button
                              onClick={() => handleExtendMonth(lib)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-bold transition cursor-pointer"
                              title="Record monthly ₹ payment and extend 30 days"
                            >
                              💵 Paid +30d
                            </button>

                            <button
                              onClick={() => handleExtendTrial(lib, 7)}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-[11px] font-bold transition cursor-pointer"
                              title="Extend or reset free trial by 7 days"
                            >
                              ⏳ +7d Trial
                            </button>

                            {!lib.is_lifetime_fixed && (
                              <button
                                onClick={() => handleExpireTrial(lib)}
                                className="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[11px] font-bold transition cursor-pointer"
                                title="Simulate trial expiration to test locked paywall (data preserved)"
                              >
                                🔒 Expire Now
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setEditingLibrary(lib);
                                setNewFee(lib.monthly_fee);
                                setIsLifetimeFixed(lib.is_lifetime_fixed);
                              }}
                              className="px-2 py-1 rounded-lg bg-card-bg border border-panel-border hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[11px] font-bold transition cursor-pointer text-text-muted hover:text-text-main"
                              title="Change fee or lock discount"
                            >
                              ✏️ Rate
                            </button>

                            {/* 👑 Master Login (Ghost Mode) Button */}
                            <button
                              onClick={() => handleMasterLogin(lib)}
                              className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white text-[11px] font-black shadow-2xs transition cursor-pointer flex items-center gap-1 active:scale-95"
                              title="1-Click Master Login as Owner into this library workspace (zero password prompt)"
                            >
                              <span>👑</span> Master
                            </button>

                            {/* 🔑 Reset Passwords Modal Button */}
                            <button
                              onClick={() => handleOpenPasswordModal(lib)}
                              className="px-2 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                              title="View & Reset Owner or Staff Passwords without knowing previous passwords"
                            >
                              <span>🔑</span> Passwords
                            </button>

                            {/* 🖼️ Manage & Upload Logo Button */}
                            <button
                              onClick={() => handleOpenLogoModal(lib)}
                              className="px-2 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                              title="Upload or Change Logo for this library"
                            >
                              <span>🖼️</span> Logo
                            </button>

                            <Link
                              href={`/l/${lib.slug}`}
                              target="_blank"
                              onClick={() => impersonateTenantOwner(lib.slug, lib.name, lib.id)}
                              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold transition flex items-center gap-1"
                              title="Open Desk Workspace (Owner Authorized)"
                            >
                              <span>🪑</span> Desk
                            </Link>

                            <Link
                              href={`/l/${lib.slug}/settings`}
                              target="_blank"
                              onClick={() => impersonateTenantOwner(lib.slug, lib.name, lib.id)}
                              className="px-2 py-1 rounded-lg bg-card-bg border border-panel-border hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[11px] font-bold transition text-text-muted hover:text-text-main"
                              title="Open Owner Settings (Owner Authorized)"
                            >
                              ⚙️
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Copy Toast Notification */}
      {copyFeedback && (
        <div className="fixed bottom-6 right-6 z-50 bg-neutral-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl border border-neutral-700 animate-in fade-in slide-in-from-bottom-2 flex items-center gap-2">
          <span>📋</span> {copyFeedback}
        </div>
      )}

      {/* Onboard New Library Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-start sm:items-center justify-center p-3 sm:p-4 md:p-6 z-50 overflow-y-auto animate-in fade-in"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="my-auto bg-card-bg border border-panel-border rounded-3xl max-w-lg w-full shadow-2xl animate-in fade-in zoom-in duration-150 flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[88vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-panel-border p-4 sm:p-5 shrink-0 bg-card-bg">
              <div>
                <h3 className="font-extrabold text-lg text-text-main">
                  Onboard New Study Library
                </h3>
                <p className="text-xs text-text-muted">
                  Create a new dedicated workspace for a library in Dehradun.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-neutral-500/10 hover:bg-neutral-500/20 text-text-muted hover:text-text-main flex items-center justify-center text-sm font-bold cursor-pointer transition shrink-0"
                title="Close (Esc)"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLibrary} className="p-4 sm:p-6 space-y-3.5 text-xs overflow-y-auto flex-1 overscroll-contain">
              <div>
                <label className="font-semibold block mb-1">Library Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Reading Room"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">URL Identifier (Slug) *</label>
                <div className="flex items-center bg-background border border-panel-border rounded-xl px-3 py-2">
                  <span className="text-text-muted font-mono">/l/</span>
                  <input
                    type="text"
                    required
                    placeholder="apex-reading-room"
                    value={formData.slug}
                    onChange={(e) => setFormData((p) => ({ ...p, slug: e.target.value }))}
                    className="w-full bg-transparent font-mono text-text-main focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))}
                    className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Owner Phone</label>
                  <input
                    type="tel"
                    placeholder="9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                    className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Total Seats</label>
                  <input
                    type="number"
                    min="10"
                    max="500"
                    value={formData.total_seats}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, total_seats: Number(e.target.value) }))
                    }
                    className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Monthly SaaS Fee (₹)</label>
                  <input
                    type="number"
                    step="50"
                    value={formData.monthly_fee}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, monthly_fee: Number(e.target.value) }))
                    }
                    className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 font-bold text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">
                  Desk Soundbox / Merchant UPI ID (for QR admissions)
                </label>
                <input
                  type="text"
                  placeholder="e.g. libraryname@paytm or @okicici"
                  value={formData.upi_id}
                  onChange={(e) => setFormData((p) => ({ ...p, upi_id: e.target.value }))}
                  className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Owner Passcode</label>
                  <input
                    type="text"
                    placeholder="OwnerPass2026"
                    value={formData.owner_password}
                    onChange={(e) => setFormData((p) => ({ ...p, owner_password: e.target.value }))}
                    className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Staff Passcode</label>
                  <input
                    type="text"
                    placeholder="StaffPass2026"
                    value={formData.staff_password}
                    onChange={(e) => setFormData((p) => ({ ...p, staff_password: e.target.value }))}
                    className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-panel-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-panel-border font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-sm transition disabled:opacity-50"
                >
                  {submitting ? "Onboarding..." : "Confirm & Launch Library"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Rate Modal */}
      {editingLibrary && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-start sm:items-center justify-center p-3 sm:p-4 md:p-6 z-50 overflow-y-auto animate-in fade-in"
          onClick={() => setEditingLibrary(null)}
        >
          <div
            className="my-auto bg-card-bg border border-panel-border rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-150 max-h-[calc(100vh-2rem)] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-extrabold text-base text-text-main mb-1">
              Adjust Monthly Rate
            </h3>
            <p className="text-xs text-text-muted mb-4">
              Set custom price or grandfathered discount for {editingLibrary.name}.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Monthly Subscription (₹)</label>
                <input
                  type="number"
                  step="50"
                  value={newFee}
                  onChange={(e) => setNewFee(Number(e.target.value))}
                  className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-base font-bold text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={isLifetimeFixed}
                  onChange={(e) => setIsLifetimeFixed(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500"
                />
                <span className="font-semibold text-text-main">
                  ⭐ Grandfather Lifetime Rate (VIP)
                </span>
              </label>

              <div className="pt-4 border-t border-panel-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingLibrary(null)}
                  className="px-3 py-1.5 rounded-xl border border-panel-border font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePrice}
                  className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition"
                >
                  Save Rate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage & Reset Tenant Passwords Modal */}
      {passwordModalLib && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-start sm:items-center justify-center p-3 sm:p-4 md:p-6 z-50 overflow-y-auto animate-in fade-in"
          onClick={() => setPasswordModalLib(null)}
        >
          <div
            className="my-auto bg-card-bg border border-panel-border rounded-3xl max-w-lg w-full shadow-2xl animate-in fade-in zoom-in duration-150 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-panel-border p-4 sm:p-5 bg-card-bg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xl">
                  🔑
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-text-main">
                    Password & Master Access
                  </h3>
                  <p className="text-xs text-text-muted">
                    {passwordModalLib.name} • /l/{passwordModalLib.slug}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPasswordModalLib(null)}
                className="w-8 h-8 rounded-full bg-neutral-500/10 hover:bg-neutral-500/20 text-text-muted hover:text-text-main flex items-center justify-center text-sm font-bold cursor-pointer transition shrink-0"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-5 text-xs">
              {/* Ghost Mode Instant Entry Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-transparent border border-amber-500/30 flex items-center justify-between gap-3">
                <div>
                  <div className="font-extrabold text-sm text-text-main flex items-center gap-1.5">
                    <span>👑</span> Instant Ghost Mode Login
                  </div>
                  <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">
                    Enter this library workspace immediately as Owner with all permissions unlocked. Zero password prompts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleMasterLogin(passwordModalLib)}
                  className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-black text-xs shadow-md transition active:scale-95 whitespace-nowrap cursor-pointer"
                >
                  Enter Now 🚀
                </button>
              </div>

              {/* Feedback toast inside modal */}
              {passwordActionFeedback && (
                <div
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                    passwordActionFeedback.type === "success"
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                      : "bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-300"
                  }`}
                >
                  <span>{passwordActionFeedback.type === "success" ? "✅" : "⚠️"}</span>
                  <span>{passwordActionFeedback.message}</span>
                </div>
              )}

              {/* Section 1: Reset Owner Password */}
              <div className="p-4 rounded-2xl bg-neutral-500/5 border border-panel-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-extrabold text-xs text-text-main flex items-center gap-1.5">
                    <span>👑</span> Reset Owner Password
                  </div>
                  <span className="text-[10px] text-text-muted font-mono">Role: owner</span>
                </div>
                <p className="text-[11px] text-text-muted">
                  Overwrite the owner passcode for this library. No old password required.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter new owner password..."
                    value={newOwnerPassword}
                    onChange={(e) => setNewOwnerPassword(e.target.value)}
                    className="flex-1 bg-background border border-panel-border rounded-xl px-3 py-2 text-xs text-text-main font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    disabled={updatingOwnerPass || !newOwnerPassword.trim()}
                    onClick={() => handleUpdatePassword("owner")}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50"
                  >
                    {updatingOwnerPass ? "Saving..." : "Update"}
                  </button>
                </div>
              </div>

              {/* Section 2: Reset Staff Password */}
              <div className="p-4 rounded-2xl bg-neutral-500/5 border border-panel-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-extrabold text-xs text-text-main flex items-center gap-1.5">
                    <span>💻</span> Reset Front Desk Staff Password
                  </div>
                  <span className="text-[10px] text-text-muted font-mono">Role: staff</span>
                </div>
                <p className="text-[11px] text-text-muted">
                  Overwrite the staff password used by front-desk operators.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter new staff password..."
                    value={newStaffPassword}
                    onChange={(e) => setNewStaffPassword(e.target.value)}
                    className="flex-1 bg-background border border-panel-border rounded-xl px-3 py-2 text-xs text-text-main font-mono focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <button
                    type="button"
                    disabled={updatingStaffPass || !newStaffPassword.trim()}
                    onClick={() => handleUpdatePassword("staff")}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50"
                  >
                    {updatingStaffPass ? "Saving..." : "Update"}
                  </button>
                </div>
              </div>

              {/* Master Founder Key Note */}
              <div className="text-[11px] text-text-muted bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex items-start gap-2">
                <span className="text-base">💡</span>
                <div>
                  <strong>Master SuperAdmin Override:</strong> You never need any library's password. You can always sign into any library using your founder master passcode or click <strong>Enter Now</strong> above.
                </div>
              </div>

              <div className="pt-2 border-t border-panel-border flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setPasswordModalLib(null)}
                  className="px-4 py-2 rounded-xl border border-panel-border font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Screenshot Lightbox Modal */}
      {selectedScreenshot && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setSelectedScreenshot(null)}
        >
          <div
            className="bg-card-bg border border-panel-border rounded-3xl max-w-4xl max-h-[90vh] w-full p-6 shadow-2xl flex flex-col space-y-4 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-panel-border pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">📸</span>
                <h3 className="font-extrabold text-sm text-foreground">
                  {selectedScreenshot.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedScreenshot(null)}
                className="w-8 h-8 rounded-full bg-neutral-500/10 hover:bg-neutral-500/20 text-foreground font-bold flex items-center justify-center transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-auto flex items-center justify-center p-2 bg-neutral-950/50 rounded-2xl min-h-[300px]">
              <img
                src={selectedScreenshot.url}
                alt="Full Payment Screenshot"
                className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-lg"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-panel-border text-xs text-text-muted">
              <span>Press Escape or click outside to close</span>
              <a
                href={selectedScreenshot.url}
                download="payment-screenshot.webp"
                className="font-bold text-rose-600 dark:text-rose-400 hover:underline"
              >
                Download Screenshot 📥
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Reject Payment Request Dialog Modal */}
      {rejectModalReq && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setRejectModalReq(null)}
        >
          <div
            className="bg-card-bg border-2 border-rose-500/30 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <span className="text-2xl">⚠️</span>
              <h3 className="font-black text-base text-foreground">
                Reject Payment Submission
              </h3>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              You are rejecting the payment submission of <strong>₹{rejectModalReq.amount}</strong> for <strong>{rejectModalReq.library_name}</strong>. The owner will see this reason on their renewal paywall and can re-upload a valid receipt.
            </p>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Reason for Rejection
              </label>
              <textarea
                rows={3}
                required
                placeholder="e.g. Screenshot unreadable, amount does not match, or transaction ID not found in bank statement..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full bg-background border border-panel-border rounded-xl p-3 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-panel-border">
              <button
                type="button"
                onClick={() => setRejectModalReq(null)}
                className="px-4 py-2 rounded-xl border border-panel-border text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processingReqId === rejectModalReq.id || !rejectionReason.trim()}
                onClick={handleRejectSubRequest}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
              >
                {processingReqId === rejectModalReq.id ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SaaS Platform Receiver UPI Settings Modal */}
      {showUpiModal && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-start sm:items-center justify-center p-3 sm:p-4 md:p-6 z-50 overflow-y-auto animate-in fade-in"
          onClick={() => setShowUpiModal(false)}
        >
          <div
            className="my-auto bg-card-bg border-2 border-amber-500/30 rounded-3xl max-w-xl w-full shadow-2xl animate-in fade-in zoom-in duration-150 flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-panel-border p-4 sm:p-5 shrink-0 bg-card-bg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-xl shrink-0">
                  💳
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-text-main flex items-center gap-2">
                    SaaS Receiver UPI Settings
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400">
                      Founder Only
                    </span>
                  </h3>
                  <p className="text-xs text-text-muted">
                    Configure where library owners send subscription & renewal payments.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowUpiModal(false)}
                className="w-8 h-8 rounded-full bg-neutral-500/10 hover:bg-neutral-500/20 text-text-muted hover:text-text-main flex items-center justify-center text-sm font-bold cursor-pointer transition shrink-0"
                title="Close (Esc)"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSavePlatformUpi} className="p-4 sm:p-6 space-y-4 text-xs overflow-y-auto flex-1 overscroll-contain">
              {upiSaveFeedback && (
                <div
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-start gap-2 ${
                    upiSaveFeedback.type === "success"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
                  }`}
                >
                  <span className="text-sm">{upiSaveFeedback.type === "success" ? "✓" : "⚠️"}</span>
                  <span>{upiSaveFeedback.message}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left side: Inputs */}
                <div className="space-y-3">
                  <div>
                    <label className="font-bold block mb-1 text-text-main">
                      Founder Receiver UPI ID *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. uniyalmanas@oksbi"
                      value={platformUpiId}
                      onChange={(e) => setPlatformUpiId(e.target.value)}
                      className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-xs font-mono font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <p className="text-[10px] text-text-muted mt-1">
                      Direct VPA linked to your bank (GPay, PhonePe, SBI, Paytm).
                    </p>
                  </div>

                  <div>
                    <label className="font-bold block mb-1 text-text-main">
                      Payee Display Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Manas Uniyal"
                      value={platformUpiName}
                      onChange={(e) => setPlatformUpiName(e.target.value)}
                      className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <p className="text-[10px] text-text-muted mt-1">
                      Shown to library owners in payment prompts and bank confirmation.
                    </p>
                  </div>

                  <div>
                    <label className="font-bold block mb-1 text-text-main">
                      Founder Support Phone *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 8535035757"
                      value={platformPhone}
                      onChange={(e) => setPlatformPhone(e.target.value)}
                      className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-xs font-mono text-text-main focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <p className="text-[10px] text-text-muted mt-1">
                      Used for WhatsApp fast-track payment submission and urgent support.
                    </p>
                  </div>
                </div>

                {/* Right side: Live QR Preview */}
                <div className="p-3.5 bg-neutral-500/5 rounded-2xl border border-panel-border flex flex-col items-center justify-center text-center">
                  <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">
                    Live Scanner Preview (₹599)
                  </div>
                  <div className="p-2.5 bg-white rounded-xl shadow-xs border border-neutral-200 inline-block">
                    <img
                      src={generateUpiQrCodeUrl(
                        {
                          upiId: platformUpiId || "uniyalmanas@oksbi",
                          payeeName: platformUpiName || "Manas Uniyal",
                          amount: 599,
                          note: "Test Scan - LibraryOS",
                        },
                        180
                      )}
                      alt="Live Preview QR Code"
                      className="w-36 h-36 object-contain"
                    />
                  </div>
                  <div className="text-[11px] font-mono font-bold text-text-main mt-2">
                    {platformUpiId || "uniyalmanas@oksbi"}
                  </div>
                  <p className="text-[10px] text-text-muted mt-1 leading-tight max-w-[200px]">
                    Scan this test QR with your phone to verify it opens your bank account.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl text-amber-800 dark:text-amber-200 text-[11px] leading-relaxed">
                ℹ️ <strong>Instant Live Sync:</strong> When you hit save, all payment screens (Pay &amp; Activate Early popup, trial banners, and subscription lock walls) across all study libraries in Dehradun update in real-time.
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-panel-border">
                <button
                  type="button"
                  onClick={() => setShowUpiModal(false)}
                  className="px-4 py-2 rounded-xl border border-panel-border text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingUpi}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md shadow-amber-600/20 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span>{savingUpi ? "⏳" : "💾"}</span>
                  {savingUpi ? "Saving Configuration..." : "Save Receiver Settings"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Library Logo Modal */}
      {logoModalLib && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-start sm:items-center justify-center p-3 sm:p-4 md:p-6 z-50 overflow-y-auto animate-in fade-in"
          onClick={() => setLogoModalLib(null)}
        >
          <div
            className="my-auto bg-card-bg border border-panel-border rounded-3xl max-w-xl w-full shadow-2xl animate-in fade-in zoom-in duration-150 overflow-hidden flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-panel-border p-4 sm:p-5 bg-card-bg shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xl shrink-0">
                  🖼️
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-text-main flex items-center gap-2">
                    Library Branding &amp; Logo
                  </h3>
                  <p className="text-xs text-text-muted">
                    {logoModalLib.name} • <code className="font-mono text-rose-500">/l/{logoModalLib.slug}</code>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setLogoModalLib(null)}
                className="w-8 h-8 rounded-full bg-neutral-500/10 hover:bg-neutral-500/20 text-text-muted hover:text-text-main flex items-center justify-center text-sm font-bold cursor-pointer transition shrink-0"
                title="Close (Esc)"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-5 text-xs overflow-y-auto flex-1 overscroll-contain">
              {/* Feedback toast */}
              {logoActionFeedback && (
                <div
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                    logoActionFeedback.type === "success"
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                      : "bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-300"
                  }`}
                >
                  <span>{logoActionFeedback.type === "success" ? "✅" : "⚠️"}</span>
                  <span>{logoActionFeedback.message}</span>
                </div>
              )}

              {/* Active Logo Visual Showcase */}
              <div className="p-4 rounded-2xl bg-neutral-500/5 border border-panel-border flex flex-col sm:flex-row items-center gap-4">
                <div className="p-3 bg-white dark:bg-neutral-900 rounded-2xl border border-panel-border shadow-xs flex items-center justify-center shrink-0">
                  <LibraryLogo
                    slug={logoModalLib.slug}
                    logoUrl={logoPreview}
                    name={logoModalLib.name}
                    size="2xl"
                  />
                </div>
                <div className="flex-1 text-center sm:text-left space-y-1">
                  <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                    <span className="font-extrabold text-sm text-text-main">
                      {logoPreview
                        ? logoPreview.startsWith("data:")
                          ? "Custom Uploaded Logo"
                          : "Preset Brand Asset"
                        : "Dynamic Monogram Badge"}
                    </span>
                    {logoFileSize && (
                      <span className="text-[10px] font-mono font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/30">
                        {logoFileSize}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    This logo appears instantly across member passes, thermal receipts, top navigation bars, and enrollment forms for this study room.
                  </p>
                </div>
              </div>

              {/* In-Context Mini Pass Preview */}
              <div className="p-3.5 bg-neutral-500/5 rounded-2xl border border-panel-border space-y-2">
                <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                  Live Preview in Student Pass &amp; Header
                </div>
                <div className="bg-card-bg border border-panel-border p-3 rounded-xl flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <LibraryLogo
                      slug={logoModalLib.slug}
                      logoUrl={logoPreview}
                      name={logoModalLib.name}
                      size="md"
                    />
                    <div>
                      <div className="font-extrabold text-xs text-text-main">{logoModalLib.name}</div>
                      <div className="text-[10px] text-text-muted">Digital Student ID Card • Verified Pass</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    🟢 Active
                  </span>
                </div>
              </div>

              {/* Upload Dropzone */}
              <div>
                <input
                  ref={libraryLogoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleLibraryLogoFileSelect}
                  className="hidden"
                />
                <div
                  onClick={() => libraryLogoInputRef.current?.click()}
                  className="border-2 border-dashed border-indigo-500/40 hover:border-indigo-500 rounded-2xl p-6 text-center cursor-pointer transition bg-indigo-500/5 hover:bg-indigo-500/10 group"
                >
                  <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">📁</div>
                  <div className="font-extrabold text-xs text-text-main">
                    Click to Choose Logo Image
                  </div>
                  <p className="text-[11px] text-text-muted mt-1">
                    Supports PNG, JPG, WebP, SVG. Resized and converted to fast WebP (&lt; 30 KB) automatically.
                  </p>
                </div>
              </div>

              {/* Quick Presets / Actions */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">
                  Quick Presets &amp; Reset Options:
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLogoPreview(null);
                      setLogoFileSize(null);
                    }}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      logoPreview === null
                        ? "bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300 font-bold"
                        : "bg-card-bg border-panel-border hover:bg-neutral-100 dark:hover:bg-neutral-800 text-text-main"
                    }`}
                  >
                    <span>🎨</span> Reset to Monogram Badge
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLogoPreview("/libraryos-logo.png");
                      setLogoFileSize("Default Asset");
                    }}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      logoPreview === "/libraryos-logo.png"
                        ? "bg-purple-500/15 border-purple-500/40 text-purple-700 dark:text-purple-300 font-bold"
                        : "bg-card-bg border-panel-border hover:bg-neutral-100 dark:hover:bg-neutral-800 text-text-main"
                    }`}
                  >
                    <span>📚</span> LibraryOS Brand Emblem
                  </button>

                  {logoModalLib.slug === "target-library" && (
                    <button
                      type="button"
                      onClick={() => {
                        setLogoPreview("/lib-logo.png");
                        setLogoFileSize("Default Asset");
                      }}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                        logoPreview === "/lib-logo.png"
                          ? "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300 font-bold"
                          : "bg-card-bg border-panel-border hover:bg-neutral-100 dark:hover:bg-neutral-800 text-text-main"
                      }`}
                    >
                      <span>🏛️</span> Target Library Original
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between gap-2.5 p-4 sm:p-5 border-t border-panel-border bg-card-bg shrink-0">
              <button
                type="button"
                onClick={() => setLogoModalLib(null)}
                className="px-4 py-2 rounded-xl border border-panel-border text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={savingLogo}
                  onClick={handleSaveLibraryLogo}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span>{savingLogo ? "⏳" : "💾"}</span>
                  {savingLogo ? "Saving Logo..." : "Save Logo Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SaaS Platform Brand Logo Modal */}
      {showPlatformLogoModal && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-start sm:items-center justify-center p-3 sm:p-4 md:p-6 z-50 overflow-y-auto animate-in fade-in"
          onClick={() => setShowPlatformLogoModal(false)}
        >
          <div
            className="my-auto bg-card-bg border-2 border-purple-500/30 rounded-3xl max-w-lg w-full shadow-2xl animate-in fade-in zoom-in duration-150 overflow-hidden flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-panel-border p-4 sm:p-5 bg-card-bg shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xl shrink-0">
                  🌐
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-text-main flex items-center gap-2">
                    Platform Brand Logo
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/20 text-purple-600 dark:text-purple-400">
                      Founder Only
                    </span>
                  </h3>
                  <p className="text-xs text-text-muted">
                    Configure the global SaaS brand logo shown on LibraryOS headers &amp; PWA.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPlatformLogoModal(false)}
                className="w-8 h-8 rounded-full bg-neutral-500/10 hover:bg-neutral-500/20 text-text-muted hover:text-text-main flex items-center justify-center text-sm font-bold cursor-pointer transition shrink-0"
                title="Close (Esc)"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-4 text-xs overflow-y-auto flex-1 overscroll-contain">
              {/* Feedback toast */}
              {platformLogoFeedback && (
                <div
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                    platformLogoFeedback.type === "success"
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                      : "bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-300"
                  }`}
                >
                  <span>{platformLogoFeedback.type === "success" ? "✅" : "⚠️"}</span>
                  <span>{platformLogoFeedback.message}</span>
                </div>
              )}

              {/* Active Logo Visual Showcase */}
              <div className="p-4 rounded-2xl bg-neutral-500/5 border border-panel-border flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white p-2 border border-panel-border shadow-xs flex items-center justify-center shrink-0">
                  <img
                    src={newPlatformLogoPreview || platformLogo || "/libraryos-logo.png"}
                    alt="Platform Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-text-main">
                      {newPlatformLogoPreview && newPlatformLogoPreview.startsWith("data:")
                        ? "Custom Founder Brand"
                        : "LibraryOS Official Glowing Logo"}
                    </span>
                    {platformLogoFileSize && (
                      <span className="text-[10px] font-mono font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/30">
                        {platformLogoFileSize}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    Used on SaaS Founder panel, PWA installation prompts, and system-wide badges.
                  </p>
                </div>
              </div>

              {/* Upload Dropzone */}
              <div>
                <input
                  ref={platformLogoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handlePlatformLogoFileSelect}
                  className="hidden"
                />
                <div
                  onClick={() => platformLogoInputRef.current?.click()}
                  className="border-2 border-dashed border-purple-500/40 hover:border-purple-500 rounded-2xl p-6 text-center cursor-pointer transition bg-purple-500/5 hover:bg-purple-500/10 group"
                >
                  <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">📤</div>
                  <div className="font-extrabold text-xs text-text-main">
                    Click to Upload Custom Platform Logo
                  </div>
                  <p className="text-[11px] text-text-muted mt-1">
                    Square PNG, SVG, or WebP recommended. Auto-compressed in browser.
                  </p>
                </div>
              </div>

              {/* Presets */}
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setNewPlatformLogoPreview("/libraryos-logo.png");
                    setPlatformLogoFileSize("Default Asset");
                  }}
                  className="px-3 py-1.5 rounded-xl border border-panel-border bg-card-bg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-semibold text-text-main transition cursor-pointer flex items-center gap-1.5"
                >
                  <span>🔄</span> Restore Default /libraryos-logo.png
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between gap-2.5 p-4 sm:p-5 border-t border-panel-border bg-card-bg shrink-0">
              <button
                type="button"
                onClick={() => setShowPlatformLogoModal(false)}
                className="px-4 py-2 rounded-xl border border-panel-border text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingPlatformLogo}
                onClick={handleSavePlatformLogo}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-600/20 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <span>{savingPlatformLogo ? "⏳" : "💾"}</span>
                {savingPlatformLogo ? "Saving..." : "Save Platform Logo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
