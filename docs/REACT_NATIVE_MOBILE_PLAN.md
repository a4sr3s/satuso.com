# React Native Mobile App Plan for Satuso CRM

## Executive Summary

This document outlines the plan to build a React Native mobile app for Satuso CRM, targeting iOS initially with Android support built-in. The goal is to provide a native mobile experience while maximizing code sharing with the existing web app.

---

## 1. Current State Analysis

### What We Have
| Component | Technology | Mobile Reusability |
|-----------|------------|-------------------|
| Web Frontend | React + Vite + Tailwind | Components need rewrite, logic shareable |
| API Backend | Hono + Cloudflare Workers | 100% reusable (REST API) |
| Shared Types | TypeScript package | 100% reusable |
| Authentication | Clerk | SDK available for React Native |
| State Management | TanStack Query + Zustand | Both work in React Native |
| Internationalization | i18next | Works in React Native |

### What Needs to Be Built
- New `apps/mobile` directory with React Native/Expo app
- Native UI components (no Tailwind in RN)
- Navigation system (React Navigation)
- Native features: push notifications, biometrics, offline sync

---

## 2. Recommended Tech Stack

### Framework: Expo (Managed Workflow)

**Why Expo over bare React Native:**
- Faster development cycle with Expo Go for testing
- OTA updates without App Store review
- Simpler build process (EAS Build)
- Access to Expo SDK (camera, notifications, secure storage)
- Easy upgrade path to bare workflow if needed later

**Expo SDK Version:** 52+ (latest stable)

### Core Dependencies

```json
{
  "dependencies": {
    "expo": "~52.0.0",
    "react-native": "0.76.x",

    "// Navigation": "",
    "@react-navigation/native": "^7.x",
    "@react-navigation/native-stack": "^7.x",
    "@react-navigation/bottom-tabs": "^7.x",

    "// State & Data": "",
    "@tanstack/react-query": "^5.x",
    "zustand": "^5.x",

    "// Auth": "",
    "@clerk/clerk-expo": "^2.x",
    "expo-secure-store": "~14.x",

    "// UI": "",
    "react-native-reanimated": "~3.16.x",
    "react-native-gesture-handler": "~2.20.x",
    "@shopify/flash-list": "^1.x",
    "react-native-svg": "^15.x",

    "// Utilities": "",
    "expo-haptics": "~14.x",
    "expo-local-authentication": "~15.x",
    "expo-notifications": "~0.29.x",

    "// i18n": "",
    "i18next": "^23.x",
    "react-i18next": "^14.x"
  }
}
```

---

## 3. Project Structure

```
apps/mobile/
├── app.json                    # Expo config
├── eas.json                    # EAS Build config
├── package.json
├── tsconfig.json
├── babel.config.js
├── metro.config.js
│
├── App.tsx                     # Entry point with providers
│
├── src/
│   ├── navigation/
│   │   ├── RootNavigator.tsx   # Auth vs Main flow
│   │   ├── MainTabNavigator.tsx # Bottom tabs
│   │   ├── DealsStackNavigator.tsx
│   │   ├── ContactsStackNavigator.tsx
│   │   └── types.ts            # Navigation type definitions
│   │
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── SignInScreen.tsx
│   │   │   └── SignUpScreen.tsx
│   │   │
│   │   ├── dashboard/
│   │   │   └── DashboardScreen.tsx
│   │   │
│   │   ├── deals/
│   │   │   ├── DealsListScreen.tsx
│   │   │   ├── DealDetailScreen.tsx
│   │   │   └── DealFormScreen.tsx
│   │   │
│   │   ├── contacts/
│   │   │   ├── ContactsListScreen.tsx
│   │   │   ├── ContactDetailScreen.tsx
│   │   │   └── ContactFormScreen.tsx
│   │   │
│   │   ├── tasks/
│   │   │   ├── TasksListScreen.tsx
│   │   │   └── TaskFormScreen.tsx
│   │   │
│   │   ├── ai/
│   │   │   └── AIAssistantScreen.tsx
│   │   │
│   │   └── settings/
│   │       └── SettingsScreen.tsx
│   │
│   ├── components/
│   │   ├── ui/                 # Base components
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Avatar.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── ListItem.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   └── SpinProgress.tsx
│   │   │
│   │   ├── deals/
│   │   │   ├── DealCard.tsx
│   │   │   ├── DealPipeline.tsx  # Horizontal scrollable stages
│   │   │   └── SpinSection.tsx
│   │   │
│   │   ├── contacts/
│   │   │   └── ContactCard.tsx
│   │   │
│   │   └── dashboard/
│   │       ├── MetricCard.tsx
│   │       └── ActivityFeed.tsx
│   │
│   ├── lib/
│   │   ├── api.ts              # Copy from web, adapt for RN
│   │   └── storage.ts          # Expo SecureStore wrapper
│   │
│   ├── hooks/
│   │   ├── useAuth.ts          # Clerk wrapper
│   │   ├── useContacts.ts      # React Query hooks
│   │   ├── useDeals.ts
│   │   ├── useTasks.ts
│   │   ├── useDashboard.ts
│   │   └── useVoiceRecorder.ts # Expo AV for voice notes
│   │
│   ├── stores/
│   │   └── locale.ts           # Language preference
│   │
│   ├── i18n/
│   │   ├── config.ts
│   │   └── index.ts
│   │
│   ├── theme/
│   │   ├── colors.ts           # Design tokens
│   │   ├── spacing.ts
│   │   ├── typography.ts
│   │   └── index.ts
│   │
│   └── types/
│       └── index.ts            # Re-export from @satuso/shared
│
└── assets/
    ├── icon.png
    ├── splash.png
    └── adaptive-icon.png
```

---

## 4. Code Sharing Strategy

### Fully Shareable (No Changes)
| Code | Location | Notes |
|------|----------|-------|
| TypeScript types | `packages/shared` | Import directly |
| API endpoints | `apps/api` | Same REST API |
| Zod schemas | Can extract to shared | Validation logic |
| i18n translations | Can extract to shared | JSON translation files |

### Partially Shareable (Adapt)
| Code | Web Location | Mobile Adaptation |
|------|--------------|-------------------|
| API client | `apps/web/src/lib/api.ts` | Change token storage to SecureStore |
| React Query hooks | Inline in pages | Extract to `hooks/` folder |
| Business logic | Spread across pages | Extract to shared utilities |

### Not Shareable (Rebuild)
| Component | Reason |
|-----------|--------|
| UI Components | Tailwind CSS doesn't work in RN |
| Navigation | React Router vs React Navigation |
| Forms | Different input handling in RN |
| Animations | CSS vs Reanimated |

### Recommended: Extract Shared Package

Create `packages/core` for shared business logic:

```
packages/core/
├── src/
│   ├── api/
│   │   ├── client.ts         # API client (platform-agnostic)
│   │   ├── contacts.ts       # Contact API methods
│   │   ├── deals.ts
│   │   ├── tasks.ts
│   │   └── dashboard.ts
│   │
│   ├── hooks/                # Platform-agnostic hooks
│   │   ├── useContacts.ts
│   │   ├── useDeals.ts
│   │   └── useTasks.ts
│   │
│   ├── utils/
│   │   ├── formatting.ts     # Date, currency formatting
│   │   ├── validation.ts     # Zod schemas
│   │   └── spin.ts           # SPIN score calculations
│   │
│   └── i18n/
│       ├── en.json
│       └── es.json
│
└── package.json
```

---

## 5. Screen Inventory & Priority

### Phase 1: Core CRM (MVP)

| Screen | Priority | Complexity | Notes |
|--------|----------|------------|-------|
| Sign In | P0 | Low | Clerk Expo integration |
| Sign Up | P0 | Low | Clerk Expo integration |
| Dashboard | P0 | Medium | Metrics, activity feed |
| Deals List | P0 | Medium | Pipeline view (horizontal scroll) |
| Deal Detail | P0 | High | SPIN data, team, activities |
| Contacts List | P0 | Low | Search, filter |
| Contact Detail | P0 | Medium | Info, activities, deals |
| Tasks List | P0 | Low | Filter by status |
| Settings | P0 | Low | Profile, logout, language |

### Phase 2: Enhanced Features

| Screen | Priority | Complexity | Notes |
|--------|----------|------------|-------|
| AI Assistant | P1 | Medium | Chat interface |
| Companies List | P1 | Low | Basic CRUD |
| Company Detail | P1 | Medium | Contacts, deals |
| Deal Form | P1 | Medium | Create/edit deal |
| Contact Form | P1 | Medium | Create/edit contact |
| Task Form | P1 | Low | Quick add task |
| Voice Notes | P1 | Medium | Record, transcribe, SPIN extract |

### Phase 3: Advanced Features

| Screen | Priority | Complexity | Notes |
|--------|----------|------------|-------|
| Workboards | P2 | High | Complex table views |
| Notifications | P2 | Medium | Push notification center |
| Offline Mode | P2 | High | SQLite local cache |
| Widgets | P2 | Medium | iOS widgets for quick metrics |

---

## 6. Navigation Architecture

```
RootNavigator
├── AuthStack (when not signed in)
│   ├── SignInScreen
│   └── SignUpScreen
│
└── MainTabNavigator (when signed in)
    ├── DashboardTab
    │   └── DashboardScreen
    │
    ├── DealsTab
    │   └── DealsStackNavigator
    │       ├── DealsListScreen
    │       ├── DealDetailScreen
    │       └── DealFormScreen
    │
    ├── ContactsTab
    │   └── ContactsStackNavigator
    │       ├── ContactsListScreen
    │       ├── ContactDetailScreen
    │       └── ContactFormScreen
    │
    ├── TasksTab
    │   └── TasksStackNavigator
    │       ├── TasksListScreen
    │       └── TaskFormScreen
    │
    └── MoreTab
        └── MoreStackNavigator
            ├── SettingsScreen
            ├── AIAssistantScreen
            └── CompaniesListScreen
```

### Bottom Tab Icons (Lucide equivalents in RN)
- Dashboard: `LayoutDashboard`
- Deals: `Handshake`
- Contacts: `Users`
- Tasks: `CheckSquare`
- More: `Menu`

---

## 7. Mobile-First UI Considerations

### Deal Pipeline (Key Differentiator)

The web app uses a Kanban board. On mobile, use a **horizontal scrollable pipeline**:

```
┌─────────────────────────────────────────────────┐
│  [Lead]  [Qualified]  [Discovery]  [Proposal]   │ ← Scrollable tabs
├─────────────────────────────────────────────────┤
│  ┌─────────────────┐                            │
│  │ Acme Corp       │                            │
│  │ $50,000         │ ← Swipeable cards          │
│  │ ████████░░ 80%  │   (swipe to change stage)  │
│  └─────────────────┘                            │
│  ┌─────────────────┐                            │
│  │ Beta Inc        │                            │
│  │ $25,000         │                            │
│  │ ██████░░░░ 60%  │                            │
│  └─────────────────┘                            │
└─────────────────────────────────────────────────┘
```

### SPIN Score Visualization

Keep the circular progress indicator from web, adapt with `react-native-svg`:

```
     ┌───────────┐
     │    85     │  ← Large number in center
     │   ████    │  ← Circular progress ring
     │  SPIN Score│
     └───────────┘

 S: ██████████ 90%
 P: ████████░░ 80%
 I: ██████░░░░ 60%
 N: ████████████ 100%
```

### Quick Actions

Floating Action Button (FAB) for quick add:
- Add Deal
- Add Contact
- Add Task
- Log Activity
- Voice Note

### Gestures

| Gesture | Action |
|---------|--------|
| Swipe left on deal card | Move to next stage |
| Swipe right on deal card | Move to previous stage |
| Swipe left on task | Complete task |
| Long press on contact | Quick actions menu |
| Pull to refresh | Refresh list data |

---

## 8. Authentication Flow

### Clerk Expo Integration

```typescript
// App.tsx
import { ClerkProvider, ClerkLoaded } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';

const tokenCache = {
  async getToken(key: string) {
    return SecureStore.getItemAsync(key);
  },
  async saveToken(key: string, value: string) {
    return SecureStore.setItemAsync(key, value);
  },
};

export default function App() {
  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      tokenCache={tokenCache}
    >
      <ClerkLoaded>
        <RootNavigator />
      </ClerkLoaded>
    </ClerkProvider>
  );
}
```

### Biometric Authentication (Phase 2)

Use `expo-local-authentication` for Face ID / Touch ID:
- Enable after first successful Clerk login
- Store preference in SecureStore
- Fallback to Clerk auth if biometrics fail

---

## 9. Offline Strategy (Phase 3)

### Local Database

Use `expo-sqlite` or `@op-engineering/op-sqlite` for offline cache:

```
Local SQLite
├── contacts (cached list, last sync timestamp)
├── deals (cached list, last sync timestamp)
├── tasks (cached list, last sync timestamp)
├── pending_changes (queue for offline mutations)
└── sync_status (per-entity sync state)
```

### Sync Strategy

1. **Read:** Check local cache first, fetch from API if stale (>5 min)
2. **Write:** Queue mutations locally, sync when online
3. **Conflict Resolution:** Server wins (last-write-wins)
4. **Background Sync:** Use Expo Background Fetch

---

## 10. Push Notifications (Phase 2)

### Notification Types

| Trigger | Notification |
|---------|--------------|
| Task due today | "You have 3 tasks due today" |
| Task overdue | "Task 'Follow up with John' is overdue" |
| Deal stage change | "Deal 'Acme' moved to Proposal" |
| New team assignment | "You were added to deal 'Beta Inc'" |
| AI insight | "AI detected a risk in 'Gamma Corp' deal" |

### Implementation

1. Register for push notifications via Expo
2. Store push token in backend (`users.push_token`)
3. Backend sends via Expo Push Notification Service
4. Handle deep links to specific screens

---

## 11. Implementation Phases

### Phase 1: Foundation (Weeks 1-3)

**Week 1: Project Setup**
- [ ] Initialize Expo project in `apps/mobile`
- [ ] Configure TypeScript, ESLint, Prettier
- [ ] Set up EAS Build for iOS
- [ ] Integrate Clerk Expo SDK
- [ ] Create design tokens (colors, typography, spacing)
- [ ] Build base UI components (Button, Input, Card)

**Week 2: Authentication & Navigation**
- [ ] Implement SignIn/SignUp screens
- [ ] Set up React Navigation structure
- [ ] Create MainTabNavigator with placeholder screens
- [ ] Connect API client with Clerk token
- [ ] Test end-to-end auth flow

**Week 3: Core Screens**
- [ ] Dashboard screen with metrics
- [ ] Deals list with pipeline view
- [ ] Contacts list with search
- [ ] Tasks list with filters
- [ ] Settings screen

### Phase 2: Full CRUD (Weeks 4-6)

**Week 4: Deal Management**
- [ ] Deal detail screen (full SPIN display)
- [ ] Deal form (create/edit)
- [ ] Stage change with swipe gesture
- [ ] Deal team display
- [ ] Activity logging

**Week 5: Contact & Company Management**
- [ ] Contact detail screen
- [ ] Contact form (create/edit)
- [ ] Company list and detail
- [ ] Link contacts to deals

**Week 6: Tasks & Activities**
- [ ] Task detail and form
- [ ] Quick task completion
- [ ] Activity feed
- [ ] Log calls, emails, meetings, notes

### Phase 3: AI & Voice (Weeks 7-8)

**Week 7: AI Assistant**
- [ ] AI chat interface
- [ ] SPIN suggestions display
- [ ] AI insights on dashboard

**Week 8: Voice Features**
- [ ] Voice recording with Expo AV
- [ ] Speech-to-text via API
- [ ] SPIN extraction from transcripts
- [ ] Text-to-speech playback

### Phase 4: Polish & Launch (Weeks 9-10)

**Week 9: UX Polish**
- [ ] Loading states and skeletons
- [ ] Error handling and retry
- [ ] Haptic feedback
- [ ] Animations with Reanimated
- [ ] Pull-to-refresh everywhere

**Week 10: App Store Prep**
- [ ] App icons and splash screen
- [ ] App Store screenshots
- [ ] Privacy policy compliance
- [ ] TestFlight beta testing
- [ ] App Store submission

### Phase 5: Advanced Features (Post-Launch)

- [ ] Push notifications
- [ ] Biometric authentication
- [ ] Offline mode with local SQLite
- [ ] iOS widgets
- [ ] Apple Watch companion (future)

---

## 12. Testing Strategy

### Unit Tests
- Jest + React Native Testing Library
- Test business logic and hooks
- Mock API responses

### Integration Tests
- Detox for E2E testing
- Critical flows: auth, create deal, complete task

### Manual Testing
- Expo Go for development
- TestFlight for beta testing
- Test on multiple iOS devices (iPhone SE, 14, 15 Pro Max)

---

## 13. Build & Deployment

### EAS Build Configuration

```json
// eas.json
{
  "cli": { "version": ">= 5.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": false }
    },
    "production": {
      "ios": { "resourceClass": "m1-medium" }
    }
  },
  "submit": {
    "production": {
      "ios": { "appleId": "your@email.com" }
    }
  }
}
```

### CI/CD Pipeline

```yaml
# GitHub Actions workflow
on:
  push:
    branches: [main]
    paths: ['apps/mobile/**']

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: eas build --platform ios --profile preview --non-interactive
```

---

## 14. Success Metrics

### Launch Goals
- [ ] App Store approval within 2 weeks of submission
- [ ] <3 second cold start time
- [ ] <100ms touch response time
- [ ] 4.5+ star rating target

### Usage Goals (3 months post-launch)
- [ ] 30% of active users access via mobile
- [ ] 50% of tasks completed on mobile
- [ ] 25% of deal updates made on mobile

---

## 15. Open Questions

1. **App Name:** "Satuso" or "Satuso CRM"?
2. **Pricing:** Same subscription as web, or separate mobile tier?
3. **Feature Parity:** Full feature parity or mobile-optimized subset?
4. **Android Timeline:** Simultaneous or iOS-first?
5. **Apple Watch:** Is this on the roadmap?

---

## 16. Next Steps

1. **Approve this plan** - Review and confirm approach
2. **Create Expo project** - Initialize `apps/mobile`
3. **Set up Clerk** - Configure Clerk for Expo
4. **Build foundation** - Design system and base components
5. **Implement Phase 1** - Auth and core screens

---

*Document created: January 2026*
*Last updated: January 2026*
*Author: Claude (AI Assistant)*
