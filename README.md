# Nillion Keychain

## Overview

Nillion Keychain is feature-rich browser extension for interacting with data stored in Nillion SecretVaults. This makes onboarding and usafe for real-world applications easier for non-technical users by freeing them from manual key management.

Current version allows users to:

- Create their DIDs
- Manage their DIS: export / import private keys, list stored documents and collections, view details
- ACL - manage access control for documents either by granting permissions to new builder DIDs, modifying current access or revoking access
- Manage documents - View stored data and delete it once it's no longer needed
- Connect with Nillion - Connect with DID to websites integrating Nillion with active DID
- Wallet <-> Dapp communication - Once connected, dapp can requests actions in walleet like listing data, storing new documents, requesting access to documents, reading document details

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
