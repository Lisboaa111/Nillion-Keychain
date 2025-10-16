# Nillion Keychain

## Overview

Nillion Keychain is feature-rich browser extension for interacting with data stored in Nillion SecretVaults. This makes onboarding and usafe for real-world applications easier for non-technical users by freeing them from manual key management.

Current version allows users to:

- Create their DIDs(DIDs are generated using `Keypair.generate();` from Nillion library, private keys are encrypted using chosen password and kept encrypted in local storage)
- Manage their DIS: export / import private keys, list stored documents and collections, view details
- ACL - manage access control for documents either by granting permissions to new builder DIDs, modifying current access or revoking access
- Manage documents - View stored data and delete it once it's no longer needed
- Connect with Nillion - Connect with DID to websites integrating Nillion with active DID
- Wallet <-> Dapp communication - Once connected, dapp can requests actions in walleet like listing data, storing new documents, requesting access to documents, reading document details

## Core Features Breakdown

1. Key Management (Wallet Tab)

- Create new keypair using Keypair.generate() from @nillion/nuc
- Import existing private key
- Export private key (with reveal mechanism)
- Display DID (Decentralized Identifier)
- Subscription status checking (connects to localhost:3001)

2. Connection Management

- Site approval flow: When dApps call window.nillion.connect(), a popup appears
- Connected sites list: Shows all authorized origins
- Disconnect capability: Revoke site access and notify all tabs
- Auto-reconnection: Checks connection status on page load

3. Data Storage Operations

- Stores encrypted data on Nillion network
- Automatically grants access to builder DID
- Returns collection + document ID

4. Data Retrieval

- Fetches encrypted data by collection/document ID
- Requires proper ACL permissions

5. Access Control (ACL Management)
   **Features:**

- **View ACL list** for each document
- **Grant access** to new DIDs with custom permissions (read/write/execute)
- **Modify permissions** for existing accessors
- **Revoke access** from specific DIDs
- **Owner protection**: Owner entry cannot be removed

6. Document Browser

- **List all documents** owned by the user
- **View document content** (pretty-formatted or raw JSON)
- **Copy document/collection IDs**
- **Delete documents** permanently
- **Real-time data loading**

## Communication Flow\*\*

```

dApp (MAIN world)
↓ CustomEvent: NILLION_REQUEST
bridge.js (ISOLATED world)
↓ chrome.runtime.sendMessage
background.js
↓ chrome.windows.create (approval popup)
App.tsx (popup)
↓ User approval
↓ Execute via SecretVaultUserClient
↓ chrome.runtime.sendMessage (APPROVAL_RESPONSE)
background.js
↓ CustomEvent: NILLION_RESPONSE
bridge.js
↓ Resolve promise in dApp
```

**API Exposed to dApps**

```
javascriptwindow.nillion = {
isConnected: boolean,
userDid: string | null,

connect() → {did: string},
getDid() → string,
storeData(params) → result,
retrieveData(params) → data,
grantAccess(params) → success,
revokeAccess(params) → success,
listData() → array,
disconnect() → void
}
```

**Node Configuration**

Hardcoded staging nodes:

```
const NODES = [
"https://nildb-stg-n1.nillion.network",
"https://nildb-stg-n2.nillion.network",
"https://nildb-stg-n3.nillion.network"
]
```

## Documentation

Docusaurus documentation is hosted at: https://nillion-keychain-docs.vercel.app/

It includes more detailed breakdown of features and tech under the hood of Nillion Keychain.

## Setup

**Extension**

- Install dependencies `npm i`
- Run extension in dev mode `npm run dev`
- Once Chrome with extension is loaded, click on icon to open it and set it up by either creating new wallet or importing private key
- To test dapp integration set up dapp and backend first

**Dapp**

- Install dependencies `npm i`
- Set `.env` variables
- Run extension in dev mode `npm run dev`
- Open dapp in the browser `http://localhost:5173`

**Backend**

- Install dependencies `npm i`
- Set `.env` variables
- Start server `npm run dev`

**Documentation**

- Install dependencies `npm i`
- Start docusaurus locally `npm run start`

```

```

```

```
