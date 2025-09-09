# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Naver Maps Field Management Program (네이버 지도 필지 관리 프로그램) - a web application for managing parcels/lots using Naver Maps API and Vworld API. It allows users to visualize, color-code, and manage land parcel information with features like address search, parcel data management, and Google Sheets integration.

## Development Commands

```bash
# Development server (Express.js)
node server.js                     # Start main development server

# Alternative development servers
npm run dev                        # Next.js dev (not used in this static project)
npm run build                      # Next.js build (not used)
npm run start                      # Next.js start (not used)

# Testing (Playwright)
npm test                           # Run all tests
npx playwright test                # Run Playwright tests directly
npx playwright test --headed       # Run tests with browser visible
npx playwright test --debug        # Run tests in debug mode
npx playwright test --ui           # Run tests with Playwright UI
npx playwright test tests/specific-test.spec.js  # Run single test file

# Test development and debugging
npx playwright codegen             # Generate test code interactively
npx playwright show-report         # View test report

# Database Setup (Supabase)
# Run SQL files in order:
# 1. db/schema-korean.sql          # Core database schema
# 2. db/migration-functions-final.sql # Migration functions
# 3. db/setup-complete.sql         # Complete setup

# Environment setup
cp .env.example .env               # Copy environment template
```

**Server Configuration**: Runs on port 3000 with automatic fallback to port 4000 if occupied. Use `PORT=4000 node server.js` to force specific port.

## Architecture Overview

### Frontend Structure
- **Static HTML/CSS/JavaScript application** served via Express.js
- **Main entry point**: `public/index.html`
- **Core JavaScript modules** in `public/js/`:
  - `map.js`, `map-init.js` - Naver Maps integration and initialization
  - `parcel.js`, `parcel-manager.js`, `parcel-panel.js` - Parcel data handling and management
  - `data-manager.js` - Hybrid localStorage/Supabase sync system (60k parcels + 30k memos)
  - `data-manager-realtime.js` - Real-time collaborative editing with broadcast channels
  - `search.js` - Address and parcel search functionality
  - `sheets.js` - Google Sheets integration with 4-tier fallback system
  - `auth.js` - Google OAuth authentication handling
  - `config.js`, `config-client.js` - API keys and configuration with ULTRATHINK fallbacks
  - `viewport-renderer.js` - Performance-optimized polygon rendering
  - `indexeddb-cache.js` - Browser-level caching for large datasets
  - `realtime-ui.js` - Real-time status indicators and activity feeds
  - `mobile-handler.js` - Mobile device optimizations

### Backend Structure
- **Express.js server** (`server.js`) with:
  - Static file serving from `/public`
  - CORS enabled for API requests
  - **VWorld API proxy** at `/api/vworld` with 5-key rotation fallback system
  - Automatic port conflict resolution (3000 → 4000)
  - Comprehensive error logging and request monitoring

### API Integration
- **Naver Maps API v3** - Map rendering and geocoding (Client ID: `xzbnwd2h1z`)
- **VWorld API** - Korean parcel/lot data with intelligent 5-key fallback
- **Supabase** - Real-time cloud database with 2-second debounced sync
- **Google Sheets API** - Batch data export with failure recovery

### Key Configuration Files
- `.env` / `.env.example` - API keys (Naver, VWorld, Google)
- `public/js/config.js` - Frontend configuration and API keys
- `playwright.config.js` - Test configuration with web security disabled
- `package.json` - Dependencies and scripts
- `db/schema-korean.sql` - Supabase database schema
- `db/migration-functions-final.sql` - Data migration RPC functions
- `db/setup-complete.sql` - Complete database setup script

### Testing
- **Playwright tests** in `/tests` directory covering:
  - API functionality and 5-key fallback mechanisms
  - Real-time sync and data consistency
  - Parcel data retrieval and rendering
  - Search functionality
  - UI interactions and button testing
  - Cross-browser compatibility testing

## Important Notes

### API Key Management & Multi-Strategy Systems
- **VWorld API**: 5 keys with intelligent rotation on failure. CONFIG object validation with hardcoded fallback system prevents "Cannot read properties of undefined" errors
- **Naver Maps**: Client ID `xzbnwd2h1z` embedded in frontend, geocoding proxy via `/api/naver/geocode`
- **Supabase**: Real-time database with row-level security, 2-second debounced sync
  - URL: `https://iccixxihdsvbgbkuwdqj.supabase.co`
  - Anonymous key embedded in `data-manager.js`
- **Google Sheets**: Multi-strategy loading (Script injection → iframe → Fetch → Mock API fallback)
- Environment variables should be set in `.env` file (copy from `.env.example`)

### Development Workflow
1. **Environment Setup**:
   ```bash
   cp .env.example .env               # Copy environment template
   # Edit .env with your API keys (Naver, VWorld, Google)
   ```
2. **Start Development**:
   ```bash
   node server.js                     # Start server (port 3000, fallback 4000)
   ```
3. **Access Application**: Navigate to `http://localhost:3000` (auto-fallback to :4000)
4. **Monitor Status**: Use built-in UI sync indicators and real-time activity feed
5. **Run Tests**:
   ```bash
   npm test                           # End-to-end validation
   npx playwright test --ui           # Interactive test runner
   ```

### Critical Architecture Patterns

#### ULTRATHINK Systems
This codebase implements several "ULTRATHINK" patterns for robustness:
- **5-key VWorld API fallback**: Prevents service interruption
- **Multi-strategy Google API loading**: 4 different loading methods with Mock API fallback
- **CONFIG safety system**: Runtime validation with hardcoded fallbacks
- **3-tier data persistence**: localStorage + Supabase + Google Sheets

#### Real-time Data Flow
- **CustomEvent-based communication**: Components communicate via `parcelDataSaved` events
- **2-second debounced sync**: Prevents API rate limiting while maintaining responsiveness  
- **ViewportRenderer optimization**: Large polygon datasets rendered efficiently
- **IndexedDB caching**: Browser-level persistence for 60k+ parcel records

#### Color-Coding System
- **Paint mode toggle**: ON/OFF system preserves existing coloring while controlling new additions
- **Left-click paints, right-click removes**: Direct manipulation interface
- **8-color palette**: Standardized status classification system
- **Immediate visual feedback**: Single-click complete coloring (no double-click bugs)
- **Session preservation**: Temporary coloring saved to sessionStorage and restored on page refresh
- **Visual distinction**: Temporary coloring (dashed border, 0.5 opacity) vs saved coloring (solid border, 0.7 opacity)

### Server Features
- Automatic port resolution if 3000 is occupied
- VWorld API proxy with CORS handling and 5-key rotation
- Development-friendly error logging with categorized error classification
- Naver Geocoding API proxy at `/api/naver/geocode`
- Client configuration endpoint at `/api/config`

### Important Implementation Details
- **ULTRATHINK Philosophy**: Code includes extensive safety systems and fallbacks, marked with `🎯 ULTRATHINK:` comments
- **Data Flow**: User action → UI update → sessionStorage → 2s debounce → Supabase sync → broadcast → other users
- **Search Mode Toggle**: Separate click parcels (user-selected) vs search parcels (purple highlighting)
- **M Markers**: Red "M" markers automatically appear on saved parcels to indicate stored data
- **Early Bootstrap**: System restores search parcels and temporary coloring on page load via `earlyRestoreSearchParcels()`
- **Paint Mode**: Global `window.paintModeEnabled` controls whether clicking applies colors