# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Naver Maps Field Management Program (네이버 지도 필지 관리 프로그램) - a web application for managing parcels/lots using Naver Maps API and Vworld API. It allows users to visualize, color-code, and manage land parcel information with features like address search, parcel data management, and Google Sheets integration.

## Development Commands

```bash
# Development server (Express.js)
node server.js

# Testing (Playwright)
npm test                # Run all tests
npx playwright test     # Run Playwright tests directly

# Note: package.json contains Next.js commands but project uses static Express.js
npm run dev            # Next.js dev (not used in this static project)
npm run build          # Next.js build (not used)
npm run start          # Next.js start (not used)
```

The server runs on port 3000 by default, with automatic fallback to port 4000 if 3000 is in use.

## Architecture Overview

### Frontend Structure
- **Static HTML/CSS/JavaScript application** served via Express.js
- **Main entry point**: `public/index.html`
- **Core JavaScript modules** in `public/js/`:
  - `map.js`, `map-init.js` - Naver Maps integration and initialization
  - `parcel.js`, `parcel-manager.js`, `parcel-panel.js` - Parcel data handling and management
  - `data-manager.js` - Hybrid localStorage/Supabase sync system (60k parcels + 30k memos)
  - `sync-status.js` - Real-time cloud sync status visualization
  - `search.js` - Address and parcel search functionality
  - `sheets.js` - Google Sheets integration with batch processing
  - `auth.js` - Authentication handling
  - `config.js`, `config-client.js` - API keys and configuration
  - `ui-manager.js`, `mobile-handler.js` - UI and mobile optimizations

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

### API Key Management
- **VWorld API**: 5 keys with intelligent rotation on failure (`5090194F...`, `CEB482F7...`, etc.)
- **Naver Maps**: Client ID `xzbnwd2h1z` embedded in frontend
- **Supabase**: Real-time database with row-level security
- Environment variables should be set in `.env` file

### Development Workflow
1. Copy `.env.example` to `.env` and configure API keys
2. Start server: `node server.js`
3. Access at `http://localhost:3000` (auto-fallback to :4000)
4. Monitor sync status via built-in UI indicators
5. Run tests: `npm test` for end-to-end validation

### Server Features
- Automatic port resolution if 3000 is occupied
- VWorld API proxy with CORS handling and 5-key rotation
- **Hybrid Data System**: localStorage + Supabase + Google Sheets (3-tier backup)
- **Performance optimizations**: 2-second debounced sync, circuit breaker pattern
- **Conflict prevention**: Data checksums, version tracking, exponential backoff
- Development-friendly error logging with categorized error classification