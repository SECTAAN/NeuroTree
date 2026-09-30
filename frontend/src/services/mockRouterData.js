/**
 * mockRouterData.js — centralized mock content for Router P1.
 *
 * Keyed by `${sourceNodeId}__${targetNodeId}`.
 * Falls back to a generic template for any unknown pair.
 *
 * Each entry matches the RouterData + flashcard shapes from spec 10.68 / 10.70.
 * Replace with real API calls in Milestone 6.
 */

// ── Flashcard helper ──────────────────────────────────────────────────────────
let _fcId = 1
function fc(front, back, nodeId) {
  return { id: `mock-fc-${_fcId++}`, front, back, sourceNodeId: nodeId }
}

// ── Connection mock database ──────────────────────────────────────────────────
const CONNECTIONS = {
  // Computer Networks mock tree edges
  'node_01__node_02': {
    title: 'Network Basics → IP Addressing',
    relationshipExplanation:
      'IP Addressing is a direct application of Network Basics theory. ' +
      'Understanding how packets travel through a network is the prerequisite for assigning ' +
      'logical addresses to each device on that network.',
    keyConcepts: ['IPv4 vs IPv6', 'Subnetting', 'CIDR notation', 'Private vs Public IP'],
    materials: [
      {
        id: 'm1', type: 'summary', title: 'IP Addressing Overview',
        content:
          'An IP address is a numerical label assigned to each device in a network that uses the ' +
          'Internet Protocol for communication. IPv4 uses 32-bit addresses (e.g. 192.168.1.1) ' +
          'while IPv6 uses 128-bit addresses to overcome the exhaustion of IPv4 space.',
      },
      {
        id: 'm2', type: 'example', title: 'Subnetting Example',
        content:
          'Given the network 192.168.10.0/24, the first 24 bits are the network portion. ' +
          'This gives 254 usable host addresses (192.168.10.1–192.168.10.254). ' +
          'The broadcast address is 192.168.10.255.',
      },
      {
        id: 'm3', type: 'article', title: 'RFC 791 — IPv4 Specification',
        content: 'The original Internet Protocol specification defines addressing, ' +
          'fragmentation, and routing for IPv4 packets.',
        sourceUrl: 'https://tools.ietf.org/html/rfc791',
      },
    ],
    flashcards: [
      fc('What is an IP address?',
         'A numerical label assigned to each device in a network, used to identify and locate that device for communication.',
         'node_01'),
      fc('What is the difference between a public and a private IP address?',
         'Public IPs are globally routable on the internet. Private IPs (10.x.x.x, 172.16.x.x, 192.168.x.x) are used in local networks and are not directly accessible from the internet.',
         'node_02'),
      fc('What does CIDR notation /24 mean?',
         'It means the first 24 bits of the address are the network portion, leaving 8 bits for host addresses — allowing 254 usable hosts.',
         'node_02'),
    ],
  },

  'node_02__node_03': {
    title: 'IP Addressing → Routing Protocols',
    relationshipExplanation:
      'Routing protocols operate on top of IP addressing. A router uses IP addresses to determine ' +
      'the best path to forward packets across multiple networks. Without IP addressing, ' +
      'routing tables would have no addresses to match against.',
    keyConcepts: ['RIP', 'OSPF', 'BGP', 'Static vs Dynamic Routing'],
    materials: [
      {
        id: 'm4', type: 'summary', title: 'How Routing Works',
        content:
          'A router receives a packet, reads its destination IP address, consults its routing table, ' +
          'and forwards the packet to the next hop. Routing protocols automate the process of ' +
          'building and maintaining these routing tables.',
      },
      {
        id: 'm5', type: 'example', title: 'OSPF vs RIP',
        content:
          'RIP (Routing Information Protocol) uses hop count as its metric — simple but inefficient for large networks. ' +
          'OSPF (Open Shortest Path First) uses link-state information and Dijkstra\'s algorithm to find the shortest path.',
      },
    ],
    flashcards: [
      fc('What is the main job of a routing protocol?',
         'To automatically discover network topology and build routing tables that determine the best path for forwarding packets.',
         'node_02'),
      fc('What metric does RIP use?',
         'Hop count — the number of routers a packet must pass through to reach its destination. Maximum of 15 hops.',
         'node_03'),
      fc('Why is OSPF preferred over RIP in large networks?',
         'OSPF converges faster, scales better, and uses bandwidth cost as a metric rather than simple hop count, enabling more efficient routing decisions.',
         'node_03'),
    ],
  },
}

// ── Generic fallback ──────────────────────────────────────────────────────────
function buildGeneric(sourceLabel, targetLabel) {
  return {
    title: `${sourceLabel} → ${targetLabel}`,
    relationshipExplanation:
      `${targetLabel} builds directly on the concepts introduced in ${sourceLabel}. ` +
      `Mastering ${sourceLabel} ensures you have the foundational knowledge needed to fully ' +
      'understand and apply ${targetLabel} in practice.`,
    keyConcepts: ['Prerequisite concept', 'Core dependency', 'Progressive skill'],
    materials: [
      {
        id: 'mg1', type: 'summary', title: `Why ${sourceLabel} leads to ${targetLabel}`,
        content:
          `In this knowledge circuit, ${sourceLabel} is a prerequisite for ${targetLabel}. ` +
          `The concepts, vocabulary, and mental models established in ${sourceLabel} are directly ` +
          `applied when studying ${targetLabel}.`,
      },
    ],
    flashcards: [
      fc(
        `Why is "${sourceLabel}" a prerequisite for "${targetLabel}"?`,
        `The core concepts of ${sourceLabel} provide the vocabulary and mental models that ${targetLabel} builds upon. Without this foundation, ${targetLabel} would be significantly harder to understand.`,
        null
      ),
      fc(
        `What is the main concept you carry from "${sourceLabel}" into "${targetLabel}"?`,
        `The key insight is the relationship between the two domains — understanding how the principles of ${sourceLabel} manifest as practical requirements in ${targetLabel}.`,
        null
      ),
    ],
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
/**
 * Get router mock data for a source→target pair.
 * Always returns a valid object — falls back to generic if pair is unknown.
 */
export function getMockRouterData(sourceNodeId, targetNodeId, sourceLabel, targetLabel) {
  const key = `${sourceNodeId}__${targetNodeId}`
  const data = CONNECTIONS[key] ?? buildGeneric(sourceLabel ?? sourceNodeId, targetLabel ?? targetNodeId)
  return {
    ...data,
    edgeId:       `e-${sourceNodeId}-${targetNodeId}`,
    sourceNodeId,
    targetNodeId,
    sourceLabel:  sourceLabel ?? sourceNodeId,
    targetLabel:  targetLabel ?? targetNodeId,
    createdAt:    new Date().toISOString(),
  }
}
