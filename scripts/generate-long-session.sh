#!/bin/bash
# Generate absurdly long Claude session for stress testing
# Creates a session with 1000+ messages about rubber duck authentication

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_section() {
    echo -e "\n${BLUE}=== $1 ===${NC}\n"
}

# Base directory for test data
TEST_DATA_DIR="${TEST_DATA_DIR:-/test-data}"
CLAUDE_DIR="${TEST_DATA_DIR}/.claude"
PROJECTS_DIR="${CLAUDE_DIR}/projects"

# Ensure directories exist
mkdir -p "${PROJECTS_DIR}"

# Function to create a base64 encoded path (mimicking Claude's behavior)
encode_project_path() {
    echo -n "$1" | base64 | tr -d '\n' | tr '+/' '-_' | tr -d '='
}

print_section "Creating MASSIVE stress test session"
print_status "Generating 1000+ message rubber duck authentication session..."

# Use the express-validator project for the stress test
PROJECT_PATH="/test-data/projects/project-nodejs"
ENCODED_PATH=$(encode_project_path "${PROJECT_PATH}")
SESSION_DIR="${PROJECTS_DIR}/${ENCODED_PATH}"
mkdir -p "${SESSION_DIR}"

# Start the stress test session file
STRESS_FILE="${SESSION_DIR}/session-stress-1000.jsonl"

# Initial conversation
cat > "${STRESS_FILE}" << 'EOF'
{"type":"user","content":"I need to build the world's most secure rubber duck authentication system. This is critical for enterprise security!"}
{"type":"assistant","content":"I understand you want to build a highly secure rubber duck authentication system! This is indeed a critical component for enterprise-grade rubber duck management. Let me start by examining your current security infrastructure and then we can build a comprehensive authentication system."}
{"type":"tool_use","name":"Read","parameters":{"file_path":"src/security/index.js"}}
{"type":"tool_result","content":"Error: File not found"}
{"type":"assistant","content":"I see we're starting from scratch. This is perfect - we can build the most advanced rubber duck authentication system from the ground up. Let me create the initial security module:"}
{"type":"tool_use","name":"Write","parameters":{"file_path":"src/security/rubber-duck-auth.js","content":"// Enterprise-Grade Rubber Duck Authentication System v1.0\n// WARNING: This system contains advanced duck cryptography\n\nconst crypto = require('crypto');\nconst EventEmitter = require('events');\n\nclass RubberDuckAuthenticator extends EventEmitter {\n  constructor() {\n    super();\n    this.duckRegistry = new Map();\n    this.quackTokens = new Map();\n    this.securityLevel = 'MAXIMUM';\n  }\n\n  generateDuckId() {\n    return `DUCK-${crypto.randomBytes(16).toString('hex').toUpperCase()}`;\n  }\n\n  async authenticateDuck(duckId, quackSignature) {\n    // Implement quantum-resistant duck authentication\n    const startTime = Date.now();\n    \n    // Validate quack pattern\n    if (!this.validateQuackPattern(quackSignature)) {\n      throw new Error('Invalid quack signature detected!');\n    }\n    \n    // Generate secure token\n    const token = this.generateQuackToken(duckId);\n    \n    this.emit('duck-authenticated', { duckId, duration: Date.now() - startTime });\n    return token;\n  }\n\n  validateQuackPattern(signature) {\n    // Advanced quack pattern recognition\n    const VALID_PATTERNS = [\n      /^quack{3,7}$/i,\n      /^QUACK-quack-QUACK$/,\n      /^🦆{1,5}$/\n    ];\n    \n    return VALID_PATTERNS.some(pattern => pattern.test(signature));\n  }\n\n  generateQuackToken(duckId) {\n    const payload = {\n      duckId,\n      timestamp: Date.now(),\n      entropy: crypto.randomBytes(32).toString('base64'),\n      quackLevel: Math.floor(Math.random() * 10) + 1\n    };\n    \n    return crypto\n      .createHash('sha256')\n      .update(JSON.stringify(payload))\n      .digest('hex');\n  }\n}\n\nmodule.exports = RubberDuckAuthenticator;"}}
{"type":"tool_result","content":"File created successfully"}
EOF

# Generate different categories of duck-related features
declare -a FEATURES=(
    "quantum duck entanglement"
    "blockchain duck ledger"
    "AI-powered quack analysis"
    "distributed duck consensus"
    "homomorphic duck encryption"
    "zero-knowledge duck proofs"
    "neural duck networks"
    "duck biometric scanning"
    "multi-factor duck authentication"
    "duck facial recognition"
    "voice-activated quacking"
    "GPS duck tracking"
    "rubber duck firewall"
    "duck intrusion detection"
    "automated duck compliance"
    "duck audit logging"
    "emergency duck protocols"
    "duck disaster recovery"
    "cross-platform duck sync"
    "duck API gateway"
    "serverless duck functions"
    "duck microservices"
    "containerized ducks"
    "duck orchestration"
    "duck service mesh"
    "duck observability"
    "duck chaos engineering"
    "duck feature flags"
    "duck A/B testing"
    "duck analytics dashboard"
)

declare -a PROBLEMS=(
    "The ducks are not syncing properly"
    "We need to support 1 million ducks per second"
    "The quantum ducks are interfering with classical ducks"
    "Duck authentication is too slow"
    "We need duck authentication in 37 languages"
    "The blockchain is rejecting rubber ducks"
    "AI is misidentifying plastic ducks"
    "The duck firewall is blocking legitimate quacks"
    "We need GDPR compliance for duck data"
    "The ducks need to work offline"
    "How do we handle duck impersonation attacks?"
    "The duck certificates are expiring"
    "We need duck single sign-on"
    "The duck API is rate limiting"
    "Duck sessions are timing out"
    "We need duck password recovery"
    "The duck MFA is too complex"
    "How do we migrate legacy ducks?"
    "The duck webhooks are failing"
    "We need duck data encryption at rest"
)

declare -a TECHNOLOGIES=(
    "WebAssembly"
    "Rust"
    "GraphQL"
    "gRPC"
    "Kubernetes"
    "Terraform"
    "Kafka"
    "Redis"
    "Elasticsearch"
    "TensorFlow"
    "PyTorch"
    "React Native"
    "Flutter"
    "Electron"
    "WebRTC"
    "MQTT"
    "RabbitMQ"
    "Prometheus"
    "Grafana"
    "Jenkins"
)

# Function to generate a random assistant response
generate_assistant_response() {
    local response_type=$((RANDOM % 5))
    case $response_type in
        0) echo "Excellent point! Let me implement that feature for the duck authentication system...";;
        1) echo "That's a critical security consideration for rubber ducks. I'll add advanced protection...";;
        2) echo "I see the issue. The duck authentication needs to be more robust. Let me enhance it...";;
        3) echo "Great idea! This will make our rubber duck system enterprise-ready. Implementing now...";;
        4) echo "You're absolutely right. Duck security is paramount. Let me add that functionality...";;
    esac
}

# Generate 1000+ messages
print_status "Adding 1000 rubber duck authentication messages..."
for i in {1..334}; do
    # User asks for a random feature
    FEATURE=${FEATURES[$((RANDOM % ${#FEATURES[@]}))]}
    PROBLEM=${PROBLEMS[$((RANDOM % ${#PROBLEMS[@]}))]}
    TECH=${TECHNOLOGIES[$((RANDOM % ${#TECHNOLOGIES[@]}))]}
    
    # Cycle through different request patterns
    case $((i % 6)) in
        0)
            echo "{\"type\":\"user\",\"content\":\"We need to add ${FEATURE} to the system. ${PROBLEM}\"}" >> "${STRESS_FILE}"
            ;;
        1)
            echo "{\"type\":\"user\",\"content\":\"Can you integrate ${TECH} for the ${FEATURE}?\"}" >> "${STRESS_FILE}"
            ;;
        2)
            echo "{\"type\":\"user\",\"content\":\"${PROBLEM} Can we use ${TECH} to solve this?\"}" >> "${STRESS_FILE}"
            ;;
        3)
            echo "{\"type\":\"user\",\"content\":\"The ${FEATURE} isn't working properly. We need to fix it immediately!\"}" >> "${STRESS_FILE}"
            ;;
        4)
            echo "{\"type\":\"user\",\"content\":\"How can we make the ${FEATURE} more scalable using ${TECH}?\"}" >> "${STRESS_FILE}"
            ;;
        5)
            echo "{\"type\":\"user\",\"content\":\"Security audit found issues with ${FEATURE}. ${PROBLEM}\"}" >> "${STRESS_FILE}"
            ;;
    esac
    
    # Assistant response
    RESPONSE=$(generate_assistant_response)
    echo "{\"type\":\"assistant\",\"content\":\"${RESPONSE}\"}" >> "${STRESS_FILE}"
    
    # Add tool usage for some responses
    if [ $((i % 3)) -eq 0 ]; then
        # Write a new file
        FILENAME="duck-feature-${i}.js"
        echo "{\"type\":\"tool_use\",\"name\":\"Write\",\"parameters\":{\"file_path\":\"src/features/${FILENAME}\",\"content\":\"// Implementation for ${FEATURE}\\nconst feature${i} = {\\n  name: '${FEATURE}',\\n  status: 'implemented',\\n  technology: '${TECH}'\\n};\\n\\nmodule.exports = feature${i};\"}}" >> "${STRESS_FILE}"
        echo "{\"type\":\"tool_result\",\"content\":\"File created successfully\"}" >> "${STRESS_FILE}"
    elif [ $((i % 5)) -eq 0 ]; then
        # Edit existing file
        echo "{\"type\":\"tool_use\",\"name\":\"Edit\",\"parameters\":{\"file_path\":\"src/security/rubber-duck-auth.js\",\"old_string\":\"this.securityLevel = 'MAXIMUM';\",\"new_string\":\"this.securityLevel = 'QUANTUM_MAXIMUM';\"}}" >> "${STRESS_FILE}"
        echo "{\"type\":\"tool_result\",\"content\":\"File edited successfully\"}" >> "${STRESS_FILE}"
    elif [ $((i % 7)) -eq 0 ]; then
        # Run a command
        echo "{\"type\":\"tool_use\",\"name\":\"Bash\",\"parameters\":{\"command\":\"npm install ${TECH,,}-duck-adapter --save\"}}" >> "${STRESS_FILE}"
        echo "{\"type\":\"tool_result\",\"content\":\"+ ${TECH,,}-duck-adapter@1.0.0\\nadded 142 packages from 89 contributors and audited 1337 packages in 4.2s\"}" >> "${STRESS_FILE}"
    fi
    
    # Show progress every 100 messages
    if [ $((i % 100)) -eq 0 ]; then
        print_status "Generated $((i * 3)) messages..."
    fi
done

# Add a final summary message
cat >> "${STRESS_FILE}" << 'EOF'
{"type":"user","content":"This is amazing! Can you summarize all the duck authentication features we've built?"}
{"type":"assistant","content":"Absolutely! Over the course of our extensive session, we've built the world's most comprehensive Enterprise Rubber Duck Authentication System™. Here's what we've accomplished:\n\n## 🦆 Core Authentication Features\n- Quantum-resistant duck cryptography with 2048-bit quack signatures\n- Blockchain-based distributed duck ledger for immutable authentication logs\n- AI-powered quack pattern recognition using deep neural networks\n- Multi-factor authentication including: quack patterns, duck biometrics, and GPS location\n- Zero-knowledge proof protocols for anonymous duck verification\n\n## 🔒 Security Enhancements\n- Homomorphic encryption for duck data processing\n- Advanced intrusion detection for fake duck attempts\n- Rubber duck firewall with ML-based threat detection\n- Automated compliance for GDPR, HIPAA, and SOC2 duck data\n- Emergency duck revocation protocols\n\n## 🚀 Performance & Scalability\n- Support for 1 million duck authentications per second\n- Serverless duck functions for infinite scalability\n- Redis-cached quack tokens for microsecond latency\n- Kubernetes-orchestrated duck microservices\n- Global CDN for worldwide duck access\n\n## 🔧 Enterprise Features\n- Single Sign-On (SSO) for duck fleets\n- LDAP/Active Directory duck integration\n- Comprehensive audit logging with Elasticsearch\n- Real-time duck analytics dashboard\n- 24/7 duck monitoring with Prometheus/Grafana\n\n## 🌍 Additional Capabilities\n- Support for 37 languages and duck dialects\n- Offline duck authentication with sync\n- Cross-platform SDK (iOS, Android, Web, IoT)\n- GraphQL API for flexible duck queries\n- WebRTC for real-time duck communication\n\nThis system is now production-ready and can handle any rubber duck authentication scenario imaginable! The combination of quantum computing, blockchain, AI, and traditional security measures makes this the most advanced duck authentication system ever created. 🎉"}
{"type":"user","content":"Perfect! This will revolutionize enterprise duck security forever!"}
EOF

# Create a summary file for this stress test
MESSAGES_COUNT=$(wc -l < "${STRESS_FILE}")
cat > "${SESSION_DIR}/stress-test-summary.json" << EOF
{
  "sessionId": "session-stress-1000",
  "title": "Enterprise Rubber Duck Authentication System",
  "messageCount": ${MESSAGES_COUNT},
  "created": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "duration": "6 hours",
  "features": {
    "implemented": 334,
    "technologies": 20,
    "filesCreated": 111,
    "filesEdited": 66,
    "commandsRun": 47
  },
  "performance": {
    "avgResponseTime": "1.2s",
    "totalTokens": 1500000,
    "memoryUsage": "2.3GB"
  },
  "tags": ["stress-test", "rubber-duck", "authentication", "enterprise", "comedy"]
}
EOF

print_section "Stress test session generation complete!"
print_status "Created massive session with ${GREEN}${MESSAGES_COUNT}${NC} messages"
print_status "Session file: ${STRESS_FILE}"
print_status "This session simulates:"
print_status "  - Extended conversation over 6 hours"
print_status "  - Complex enterprise requirements"
print_status "  - Multiple tool usages and file operations"
print_status "  - Absurd but technically coherent features"
print_status "  - Memory and context management stress"

# Create an index of all stress test sessions
cat > "${SESSION_DIR}/stress-tests-index.json" << EOF
{
  "stressTests": [
    {
      "id": "session-stress-1000",
      "name": "Rubber Duck Authentication Marathon",
      "messages": ${MESSAGES_COUNT},
      "purpose": "Test long conversation handling",
      "characteristics": [
        "1000+ messages",
        "Complex tool usage",
        "File creation and editing",
        "Command execution",
        "Context switching",
        "Memory pressure"
      ]
    }
  ]
}
EOF

print_status "✓ Stress test data ready for testing!"