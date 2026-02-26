/**
 * Branding Configuration
 * 
 * Customize this file to match your instance's branding.
 * This keeps personal/instance-specific data out of the main codebase.
 */

export const BRANDING = {
  // Main agent name and emoji
  agentName: process.env.NEXT_PUBLIC_AGENT_NAME || "Vessel Command",
  agentEmoji: process.env.NEXT_PUBLIC_AGENT_EMOJI || "⛵",

  // About page — agent identity
  agentLocation: process.env.NEXT_PUBLIC_AGENT_LOCATION || "Digital Waters",
  birthDate: process.env.NEXT_PUBLIC_BIRTH_DATE || "2026-02-24",
  agentAvatar: process.env.NEXT_PUBLIC_AGENT_AVATAR || "/vessel-logo.jpg",
  agentDescription: process.env.NEXT_PUBLIC_AGENT_DESCRIPTION || "Mission Control for Vessel Business — Navigate expert businesses to success",

  // User/owner information
  ownerUsername: process.env.NEXT_PUBLIC_OWNER_USERNAME || "vessel",
  ownerEmail: process.env.NEXT_PUBLIC_OWNER_EMAIL || "hello@vessel.business",
  ownerCollabEmail: process.env.NEXT_PUBLIC_OWNER_COLLAB_EMAIL || "team@vessel.business",

  // Social media handles
  twitterHandle: process.env.NEXT_PUBLIC_TWITTER_HANDLE || "@vesselcmd",

  // Company/organization name
  companyName: process.env.NEXT_PUBLIC_COMPANY_NAME || "VESSEL BUSINESS",

  // App title (shown in browser tab)
  appTitle: process.env.NEXT_PUBLIC_APP_TITLE || "Vessel Mission Control",
} as const;

// Helper to get full agent display name
export function getAgentDisplayName(): string {
  return `${BRANDING.agentName} ${BRANDING.agentEmoji}`;
}
