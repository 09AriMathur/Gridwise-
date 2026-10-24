# Requirements: Device Reminders (In-App and SMS)

## Introduction

Devices without a smart plug have to be switched on and off by hand. GridWise reminds the user at the start of the clean window ("turn it on") and at its end ("turn it off"). It does this in the app (banner, toast, bell, browser notification) and by text message (Twilio). The backend sends the texts, so they arrive even when the app is closed.

## Requirements

### Requirement 1: In-app reminders

**User Story:** As a user with a manual device, I want GridWise to tell me when to turn it on and off, so that it actually runs in the clean window.

#### Acceptance Criteria
1. WHEN a manual task's window starts AND the user hasn't marked it on THEN the system SHALL raise a "turn on" reminder: a banner on every page, a toast with an action, a bell entry and a browser notification (if allowed).
2. WHEN the window ends AND the user marked the device on THEN the system SHALL raise a "turn off" reminder.
3. Each reminder SHALL fire once per task, including across reloads.
4. WHEN the app opens late THEN a turn-on reminder SHALL still fire up to 30 min late, and a turn-off reminder up to 2 h late. Older ones SHALL be skipped.
5. Smart-plug devices SHALL NOT get reminders.
6. "I turned it on" and "I turned it off" SHALL update the task. Acting anywhere SHALL clear the matching toast and banner.
7. WHEN notification permission is "default" AND a manual task is scheduled THEN the system SHALL offer to enable browser alerts.

### Requirement 2: Text-message reminders

**User Story:** As a user, I want a text when it's time to switch a device on or off, so that I don't need GridWise open.

#### Acceptance Criteria
1. WHEN a manual task is scheduled with an E.164 phone number AND SMS is configured THEN the backend SHALL store an "on" text at the window start and an "off" text at its end.
2. The backend SHALL send due texts every 30 s, even with no browser open.
3. Text wording SHALL be composed on the server, in the user's local time, AND SHALL NOT include request-supplied free text beyond a cleaned device name (≤ 40 characters).
4. WHEN the user turns the device off in the app THEN the pending "off" text SHALL be cancelled. WHEN the task is cancelled or skipped THEN both texts SHALL be cancelled.
5. WHEN a text is more than 30 min late ("on") or more than 2 h late ("off") because the backend was down THEN it SHALL be marked skipped, not sent.
6. WHEN Twilio rejects a text THEN the reminder SHALL be marked failed with Twilio's error code and message.
7. WHEN SMS isn't configured THEN the API SHALL respond 503 naming the missing env var, AND the UI SHALL explain it and keep the in-app reminders.
8. My Home SHALL show SMS status (including a trial-account note), save the user's number in the browser, and offer "Send Test Text".
