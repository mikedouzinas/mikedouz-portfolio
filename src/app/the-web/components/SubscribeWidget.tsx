"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type WidgetState =
  | "idle"
  | "submitting"
  | "success-email"
  | "success-sms"
  | "confirming-sms"
  | "confirming"
  | "already"
  | "error";

export default function SubscribeWidget() {
  const [open, setOpen] = useState(false);
  const [contact, setContact] = useState("");
  const [state, setState] = useState<WidgetState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [smsPhone, setSmsPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = contact.trim();
    if (!val) return;

    const hasAt = val.includes("@");
    const digitCount = val.replace(/\D/g, "").length;
    if (!hasAt && digitCount < 10) {
      setState("error");
      setErrorMsg("enter a valid email or phone number.");
      return;
    }

    setState("submitting");
    setErrorMsg("");
    try {
      const res = await fetch("/api/the-web/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact: val }),
      });

      const data = await res.json();

      if (!res.ok) {
        setState("error");
        setErrorMsg(data.error || "something went wrong. try again.");
        return;
      }

      if (data.message === "already subscribed") {
        setState("already");
      } else if (data.channel === "sms") {
        setSmsPhone(data.phone);
        setState("confirming-sms");
      } else {
        setState("success-email");
      }
    } catch {
      setState("error");
      setErrorMsg("couldn't reach the server. try again.");
    }
  };

  const handleConfirmSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (smsCode.length !== 6) return;

    setState("confirming");
    setErrorMsg("");
    try {
      const res = await fetch("/api/the-web/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: smsPhone, code: smsCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setState("confirming-sms");
        setErrorMsg(data.error || "invalid code. try again.");
        return;
      }

      setState("success-sms");
    } catch {
      setState("confirming-sms");
      setErrorMsg("couldn't reach the server. try again.");
    }
  };

  const reset = () => {
    setState("idle");
    setContact("");
    setSmsCode("");
    setSmsPhone("");
    setErrorMsg("");
  };

  const isDone =
    state === "success-email" ||
    state === "success-sms" ||
    state === "already";

  return (
    <>
      <button
        onClick={() => {
          if (open && isDone) reset();
          setOpen((o) => !o);
        }}
        className="text-sm font-medium text-teal-400 hover:text-teal-300 transition-colors lowercase shrink-0"
      >
        {open ? "close" : "subscribe"}
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="w-full mt-3"
        >
          <div className="bg-gray-800/40 border border-gray-700/50 rounded-lg p-4">
            <AnimatePresence mode="wait">
              {state === "success-email" ? (
                <motion.p
                  key="success-email"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-teal-400"
                >
                  check your email to confirm.
                </motion.p>
              ) : state === "success-sms" ? (
                <motion.p
                  key="success-sms"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-teal-400"
                >
                  you&apos;re in. you&apos;ll get a text when i publish.
                </motion.p>
              ) : state === "already" ? (
                <motion.p
                  key="already"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-gray-400"
                >
                  you&apos;re already subscribed.
                </motion.p>
              ) : state === "confirming-sms" || state === "confirming" ? (
                <motion.form
                  key="sms-confirm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onSubmit={handleConfirmSms}
                  className="space-y-3"
                >
                  <p className="text-xs text-gray-400">
                    enter the 6-digit code sent to your phone.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={smsCode}
                      onChange={(e) => {
                        setSmsCode(e.target.value.replace(/\D/g, ""));
                        if (errorMsg) setErrorMsg("");
                      }}
                      placeholder="000000"
                      autoFocus
                      className="w-28 bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 text-center tracking-widest focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={smsCode.length !== 6 || state === "confirming"}
                      className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
                    >
                      {state === "confirming" ? "..." : "confirm"}
                    </button>
                  </div>
                </motion.form>
              ) : (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <form onSubmit={handleSubmit} className="flex gap-2">
                    <input
                      type="text"
                      value={contact}
                      onChange={(e) => {
                        setContact(e.target.value);
                        if (errorMsg) setErrorMsg("");
                        if (state === "error") setState("idle");
                      }}
                      placeholder="email address"
                      autoFocus
                      className="flex-1 bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={state === "submitting"}
                      className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
                    >
                      {state === "submitting" ? "..." : "subscribe"}
                    </button>
                  </form>
                  <p className="text-xs text-gray-500 mt-2">
                    new posts only. unsubscribe anytime super easily.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {errorMsg && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-red-400 mt-2"
              >
                {errorMsg}
              </motion.p>
            )}
          </div>
        </motion.div>
      )}
    </>
  );
}
