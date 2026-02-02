# TON Smart Contract Development

## Three-Tier Language Stack

### 1. Tact 1.0 (Current Recommended Standard)

**Overview:**
- Modern, statically-typed language for TON's actor model
- Up to 40% lower gas usage compared to FunC
- Built-in message handling primitives
- Compiles directly to TVM bytecode

**Features:**
- Automatic cell serialization
- Pattern matching
- Declarative data structures
- Optimized for asynchronous smart contracts
- Configurable optimization levels

**Best For:** New projects, gas-efficient contracts, modern development

### 2. FunC (Original Language)

**Overview:**
- Minimalist, functional-style language
- Low-level TVM control
- Compiles to Fift assembly, then to TVM bytecode

**Features:**
- Tighter hardware-level control
- Performance-critical optimizations
- Still widely used in ecosystem

**Best For:** Performance-critical contracts, legacy maintenance

### 3. TOLK 1.0 (Next-Generation)

**Overview:**
- Replacing FunC as primary low-level option
- Improved type system
- Automatic serialization

**Features:**
- Pattern-matching syntax
- Direct TVM control with modern syntax
- Seamless FunC migration path
- 40% gas savings through advanced optimization

**Best For:** New low-level development, FunC migration

## Developer Tools & SDKs

### Blueprint (Official Development Framework)
- All-in-one tool for writing, testing, deploying
- Supports Tact, FunC, and TOLK
- Integrated testing framework
- Deployment scripts and configuration

### TonWeb (JavaScript SDK)
- Comprehensive toolkit for TON interaction
- Wallet functionality and transaction execution
- REST API abstractions
- Cryptographic operations
- Active maintenance and documentation

### @ton/core (Core Library)
- Primary serialization/deserialization
- Cell building and slicing utilities
- Smart contract ABI handling
- Essential for low-level interaction

### @ton/crypto (Cryptography Library)
- Secure key generation
- Mnemonic handling
- Digital signature operations
- Cryptographically secure RNG

### @ton/ton (Popular Library)
- JavaScript/TypeScript integration
- Wallet and blockchain data fetching
- High-level abstractions

### Toncenter API
- RESTful API access
- @tonapibot/@tontestnetapibot integration
- Actions, Pending transactions, Emulation
- Domain management

## Jettons: Token Standard (TEP-74)

### Overview
TON's fungible token standard (analogous to ERC-20)

### Dual Smart Contract Model
1. **Jetton Master:** Global token metadata (name, symbol, supply, decimals)
2. **Jetton Wallet:** Individual user wallet contracts for balances

### 2025 Performance Improvements
- 3x transfer speed during congestion
- Production-ready official implementations
- Full integration in TON Wallet
- Layer 2 Payment Network support
- Institutional support (Standard Chartered Zodia Custody)

## Development Best Practices

### Actor Model Architecture
- Asynchronous message passing
- State-channel friendly design
- Sharding-aware contract structure

### Gas Optimization
- Use Tact 1.0 for 40% savings
- Leverage configurable optimization levels
- Profile with Blueprint testing framework

### Security
- CertiK audits available
- Overflow protection built into TVM
- Deterministic execution ensures predictability
