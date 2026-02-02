# TON Technical Architecture

## Core Network Structure: Blockchain of Blockchains

### Masterchain
- Primary blockchain storing network configuration
- Validator registry and active workchains
- Single source of truth for the entire ecosystem
- Coordinates all other chains

### Workchains
- Customizable blockchains with their own rules
- Independent token economics
- Specialized purposes and configurations
- Up to 2^32 workchains supported

### Shardchains
- Dynamically splitting/merging sub-chains
- Handle transactions for specific account ranges
- Enable parallel transaction processing

## Dynamic Sharding

### Infinite Scalability
- **Theoretical Limit:** 2^60 shards per workchain (effectively unlimited)
- Automatically splits shardchains when transaction load exceeds thresholds
- Merges when load decreases
- Organic scaling with demand without network-wide coordination

### Key Advantage
Unlike fixed-shard systems (e.g., Ethereum 2.0's 64 shards), TON's dynamic model scales organically with demand.

## Performance Metrics

### Throughput
- **Theoretical Maximum:** 104,715 TPS (CertiK-audited)
- **Average TPS (April 2025):** 4,300 (highest among all blockchains)
- **Design Target:** 100K+ TPS for full Telegram integration
- **Peak Burst Capacity:** 1,542 TPS observed

### Finality
- **Block Confirmation:** ~390 milliseconds
- **Consensus Time:** ~5 seconds
- **Fork Probability:** Near-zero (Catchain design)

## Catchain Consensus Protocol

### Byzantine Fault Tolerance (pBFT Variant)
- Network remains secure if fewer than 1/3 of validators are malicious
- Block requires 2/3+ validator signatures
- Finalized blocks cannot be reverted

### Validator Operation
- Separate validator sets per consensus round
- Signature aggregation requiring >66% super-majority
- Round duration: 65,536 seconds (~18 hours)
- Penalties for <90% block processing

### Economics
- Masterchain block subsidies: 1.7 TON per block
- Basechain block subsidies: 1 TON per block
- Approximate reward pool: 40,000 TON per consensus round
- Minimum stake: ~700,000 TON for 400 validator slots

## TON Virtual Machine (TVM)

### Stack-Based Design
- Last-in-first-out (LIFO) stack machine
- High code density
- Deterministic execution

### Machine State (6 Properties)
1. **Stack:** Primary execution data structure
2. **Control Registers:** 16 directly accessible variables
3. **Current Continuation:** Active instruction sequence
4. **Current Codepage:** TVM version specification
5. **Gas Limits:** Current, maximum, remaining, credit metrics
6. **Library Context:** Available library hashmap

### Data Types (7 Primary)
1. **Integer:** Signed 257-bit with automatic overflow protection
2. **Tuple:** Ordered collections up to 255 elements
3. **Cell:** Fundamental data structure for storage
4. **Slice:** Read operations from cells
5. **Builder:** Cell construction with write operations
6. **Continuation:** Cell-as-instruction-source abstraction
7. **Tenant:** Isolated execution context

### Key Design Principles
- **Determinism:** Identical inputs produce identical outputs
- **Overflow Protection:** Automatic arithmetic checks
- **Gas Transparency:** Explicit accounting for predictable costs
