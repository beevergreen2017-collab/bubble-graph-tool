import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import ForceGraph2D from 'react-force-graph-2d'
import { forceCollide, forceLink } from 'd3-force'
import {
  clampNodeRadius,
  decodeSpecFromQuery,
  encodeSpecToQuery,
  twoRoomStandardPreset,
  formDataToSpec,
  specToFormData,
  
  generateSpecByRoomType,
  type FormData,
  type RoomType,
  type BubbleSpec,
} from './lib/spec'

interface SelectedNode {
  id: string
  name: string
  area_target: number
  zone: string
}

function App() {
  const [spec, setSpec] = useState<BubbleSpec | null>(twoRoomStandardPreset)
  const [formData, setFormData] = useState<FormData>(() => specToFormData(twoRoomStandardPreset))
  const [roomType, setRoomType] = useState<RoomType>(parseInt(formData.roomType) as RoomType)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [containerDimensions, setContainerDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 })
  const fgRef = useRef<any>(null)
  const centerColumnRef = useRef<HTMLDivElement>(null)
  const graphWrapRef = useRef<HTMLDivElement>(null)
  const resizeTimeoutRef = useRef<number | null>(null)
  const graphZoomTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    // Parse query: accept rt (preferred) or roomType, and s (compressed spec)
    const params = new URLSearchParams(window.location.search)
    const rtParam = params.get('rt') || params.get('roomType')
    if (rtParam && ['1', '2', '3', '4'].includes(rtParam)) {
      const rt = parseInt(rtParam) as RoomType
      setRoomType(rt)
      const df = generateSpecByRoomType(rt)
      setFormData(df)
      setSpec(formDataToSpec(df))
      // continue to process `s` if present so compressed spec can override preset
    }

    const s = params.get('s')
    if (s) {
      const res = decodeSpecFromQuery(s) as any
      if (res.success) {
        setSpec(res.data)
        setFormData(specToFormData(res.data))
      }
    }

    // fit initial graph (either preset or decoded spec)
    setTimeout(() => fitGraph(), 100)
  }, [])

  function handleFormChange(newFormData: FormData) {
    setFormData(newFormData)
    const newSpec = formDataToSpec(newFormData)
    setSpec(newSpec)
  }

  // Load preset for a room type using helper from spec
  function loadPresetByRoomType(rt: RoomType) {
    setRoomType(rt)
    const df = generateSpecByRoomType(rt)
    handleFormChange(df)
    // reset layout if available
    try { resetLayout() } catch (e) { /* ignore */ }
    // reheat simulation and zoomToFit on next animation frame
    setTimeout(() => {
      if (fgRef.current && typeof fgRef.current.d3ReheatSimulation === 'function') {
        try { fgRef.current.d3ReheatSimulation() } catch (e) { /* ignore */ }
      }
      requestAnimationFrame(() => {
        if (fgRef.current && typeof fgRef.current.zoomToFit === 'function') {
          try { fgRef.current.zoomToFit(350, 60) } catch (e) { /* ignore */ }
        }
      })
    }, 0)
  }

  function copyShareLink() {
    if (!spec) return
    const encoded = encodeSpecToQuery(spec)
    const params: string[] = [`s=${encoded}`]
    if (roomType) params.push(`roomType=${roomType}`)
    const url = `${location.origin}${location.pathname}?${params.join('&')}`
    navigator.clipboard.writeText(url).then(() => {
      showToast('Link copied!')
    })
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  function fitGraph(padding = 60) {
    const w = containerDimensions.width
    const h = containerDimensions.height
    if (fgRef.current && w > 200 && h > 200) {
      fgRef.current.zoomToFit(padding * 6, padding)
      if (typeof fgRef.current.refresh === 'function') fgRef.current.refresh()
    }
  }

  function getNeighbors(nodeId: string): Set<string> {
    const neighbors = new Set<string>()
    if (!spec) return neighbors
    spec.edges?.forEach(e => {
      if (e.source === nodeId) neighbors.add(e.target)
      if (e.target === nodeId) neighbors.add(e.source)
    })
    return neighbors
  }

  function resetLayout() {
    if (fgRef.current) {
      // Reset all nodes to center
      graphData.nodes.forEach(node => {
        node.x = 0
        node.y = 0
        node.vx = 0
        node.vy = 0
      })
      // Re-run simulation
      fgRef.current.d3Force('charge').strength(-150)
      fgRef.current.numDimensions(2)
      fgRef.current.refresh()
      setTimeout(() => fitGraph(), 200)
    }
  }

  const graphData = useMemo(() => {
    if (!spec) return { nodes: [], links: [] }
    const nodes = spec.spaces.map((s) => {
      const node: any = {
        id: s.id,
        name: s.name ?? s.id,
        area_target: s.area_target,
        zone: s.zone,
        tags: s.tags || [],
      }
      
      // Apply forceX constraint based on tags
      if (s.tags?.includes('view')) {
        node.fx = 300 // Right side
      } else if (s.tags?.includes('noise')) {
        node.fx = -300 // Left side
      }
      
      return node
    })
    
    const links = (spec.edges || []).map((e) => ({
      source: e.source,
      target: e.target,
      weight: e.weight ?? 1,
      type: e.type ?? 'adjacent',
    }))
    return { nodes, links }
  }, [spec])

  // Dashboard calculations
  const dashboardData = useMemo(() => {
    if (!spec) return {
      totalArea: 0,
      spacesByZone: {},
      conditionTags: {},
    }

    // Calculate total area
    const totalArea = spec.spaces.reduce((sum, space) => sum + (space.area_target || 0), 0)

    // Group spaces by zone
    const spacesByZone: Record<string, typeof spec.spaces> = {}
    spec.spaces.forEach((space) => {
      if (!spacesByZone[space.zone]) {
        spacesByZone[space.zone] = []
      }
      spacesByZone[space.zone].push(space)
    })

    // Map conditions to tags
    const conditionTags: Record<string, { active: boolean; tag: string; strategy: string }> = {
      scenicView: {
        active: formData.conditions.scenicView,
        tag: 'view',
        strategy: '限制景觀面房間 fx = 300（右側）',
      },
      noiseControl: {
        active: formData.conditions.noiseControl,
        tag: 'noise',
        strategy: '限制噪音面房間 fx = -300（左側）',
      },
      ventilation: {
        active: formData.conditions.ventilation,
        tag: 'vent',
        strategy: '通風面連接邊權重 × 1.5',
      },
    }

    return { totalArea, spacesByZone, conditionTags }
  }, [spec, formData.conditions])

  // Fit graph when spec changes
  useEffect(() => {
    if (spec && fgRef.current) {
      setTimeout(() => fitGraph(), 50)
    }
  }, [spec])

  // Attach collision, positive-relation links, and negative-pair repulsion forces
  useEffect(() => {
    if (!fgRef.current) return
    try {
      const collideForce = forceCollide((node: any) => {
        // use visible radius + padding for collision
        return getNodeRadius(node) + COLLISION_PADDING
      }).iterations(COLLISION_ITERATIONS)

      fgRef.current.d3Force && fgRef.current.d3Force('collide', collideForce)

      // Build positive relation pairs (short strong links)
      const positivePairs: Array<{ source: string; target: string }> = []
      const negativePairs: Array<{ source: string; target: string }> = []
      if (spec) {
        spec.spaces.forEach(s => {
          (s.relations?.positive || []).forEach(tid => {
            if (tid && tid !== s.id) positivePairs.push({ source: s.id, target: tid })
          })
          ;(s.relations?.negative || []).forEach(tid => {
            if (tid && tid !== s.id) negativePairs.push({ source: s.id, target: tid })
          })
        })
      }

      // Positive relation: add a link force (does not modify visible links)
      if (positivePairs.length > 0) {
        const relLinkForce = forceLink(positivePairs as any)
          .id((d: any) => d.id)
          .distance(POS_LINK_DISTANCE)
          .strength(POS_LINK_STRENGTH)
        fgRef.current.d3Force && fgRef.current.d3Force('relationsLink', relLinkForce)
      } else {
        fgRef.current.d3Force && fgRef.current.d3Force('relationsLink', null)
      }

      // Negative relation: custom pairwise repulsion force
      function createNegativeForce(pairs: Array<{ source: string; target: string }>) {
        let nodeById: Map<string, any> = new Map()
        function force(alpha: number) {
          if (!pairs || pairs.length === 0) return
          pairs.forEach(p => {
            const a = nodeById.get(p.source)
            const b = nodeById.get(p.target)
            if (!a || !b) return
            const dx = b.x - a.x
            const dy = b.y - a.y
            let dist = Math.sqrt(dx * dx + dy * dy) || 1e-6
            const desired = NEGATIVE_DESIRED_DISTANCE
            const diff = desired - dist
            if (diff <= 0) return
            const strength = NEGATIVE_STRENGTH * alpha
            const push = (diff / desired) * strength
            const ux = dx / dist
            const uy = dy / dist
            // push a and b away from each other
            a.vx -= ux * push
            a.vy -= uy * push
            b.vx += ux * push
            b.vy += uy * push
          })
        }
        force.initialize = (nodes: any[]) => {
          nodeById = new Map(nodes.map(n => [n.id, n]))
        }
        return force
      }

      if (negativePairs.length > 0) {
        const negForce = createNegativeForce(negativePairs)
        fgRef.current.d3Force && fgRef.current.d3Force('negRelations', negForce)
      } else {
        fgRef.current.d3Force && fgRef.current.d3Force('negRelations', null)
      }

      // refresh simulation
      if (typeof fgRef.current.refresh === 'function') fgRef.current.refresh()
    } catch (e) {
      console.warn('failed to set relation forces', e)
    }
  }, [graphData, spec])

  // Setup ResizeObserver for the .graphWrap container (resize-safe)
  useEffect(() => {
    const ZOOM_DEBOUNCE_MS = 100
    const ZOOM_PADDING = 60

    const target = graphWrapRef.current
    if (!target) return

    const observer = new ResizeObserver(() => {
      if (!graphWrapRef.current) return
      const { width, height } = graphWrapRef.current.getBoundingClientRect()
      setContainerDimensions({ width, height })

      // debounce fitGraph
      if (resizeTimeoutRef.current) window.clearTimeout(resizeTimeoutRef.current)
      resizeTimeoutRef.current = window.setTimeout(() => {
        fitGraph(ZOOM_PADDING)
        resizeTimeoutRef.current = null
      }, ZOOM_DEBOUNCE_MS)
    })

    observer.observe(target)

    // initial
    const rect = target.getBoundingClientRect()
    setContainerDimensions({ width: rect.width, height: rect.height })

    return () => {
      observer.disconnect()
      if (resizeTimeoutRef.current) {
        window.clearTimeout(resizeTimeoutRef.current)
        resizeTimeoutRef.current = null
      }
    }
  }, [])

  // When graphData changes, debounce a fit-to-view to avoid jitter
  useEffect(() => {
    const ZOOM_DEBOUNCE_MS = 100
    const ZOOM_PADDING = 60

    if (graphZoomTimeoutRef.current) window.clearTimeout(graphZoomTimeoutRef.current)
    graphZoomTimeoutRef.current = window.setTimeout(() => {
      fitGraph(ZOOM_PADDING)
      graphZoomTimeoutRef.current = null
    }, ZOOM_DEBOUNCE_MS)

    return () => {
      if (graphZoomTimeoutRef.current) {
        window.clearTimeout(graphZoomTimeoutRef.current)
        graphZoomTimeoutRef.current = null
      }
    }
  }, [graphData])

  const zoneColor: Record<string, string> = {
    public: '#6fa8dc',
    private: '#ffd966',
    service: '#b6d7a8',
  }

  // Node radius helpers: use same base radius for rendering and collision
  const COLLISION_PADDING = 8 // pixels to add to visible radius for collision
  const COLLISION_ITERATIONS = 4
  const POS_LINK_DISTANCE = 90
  const POS_LINK_STRENGTH = 0.9
  const NEGATIVE_DESIRED_DISTANCE = 260
  const NEGATIVE_STRENGTH = 0.6

  function getNodeRadius(node: any) {
    return clampNodeRadius(node.area_target)
  }

  const linkStyle = (type: string) => {
    switch (type) {
      case 'adjacent':
        return { color: '#888', dash: [] }
      case 'near':
        return { color: '#f6b26b', dash: [6, 4] }
      case 'separate':
        return { color: '#6fa8dc', dash: [12, 6] }
      case 'avoid':
        return { color: '#e06666', dash: [2, 6] }
      default:
        return { color: '#999', dash: [] }
    }
  }

  return (
    <div className="layout">
      {/* Left Column: Rooms Editor */}
      <aside className="panelLeft">
        <div className="form-panel" style={{ maxHeight: 'none', marginBottom: 0, marginTop: 0 }}>
          {/* 房型切換 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
            {[1, 2, 3, 4].map((t) => (
              <label key={t} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="radio"
                  name="roomTypeSwitch"
                  value={String(t)}
                  checked={roomType === t}
                  onChange={() => { loadPresetByRoomType(t as RoomType) }}
                  style={{ marginRight: 6 }}
                />
                {t}房
              </label>
            ))}
          </div>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600 }}>Rooms 編輯器</h3>

          {/* Per-space cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {spec?.spaces.map((space) => (
              <div key={space.id} style={{ padding: 8, borderRadius: 6, border: '1px solid #e6e6e6', background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <strong style={{ fontSize: 13 }}>{space.name ?? space.id}</strong>
                  <span style={{ fontSize: 11, color: '#888' }}>{space.zone}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 13, fontWeight: 500 }}>空間名稱</label>
                    <input
                      type="text"
                      value={space.name ?? ''}
                      onChange={(e) => {
                        const val = e.target.value
                        setSpec(prev => {
                          if (!prev) return prev
                          return { ...prev, spaces: prev.spaces.map(s => s.id === space.id ? { ...s, name: val } : s) }
                        })
                      }}
                      style={{ padding: '8px', fontSize: 13, borderRadius: 4, border: '1px solid #ccc', width: '100%' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 13, fontWeight: 500 }}>單元面積</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={String(space.area_target ?? 0)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0
                        setSpec(prev => {
                          if (!prev) return prev
                          return { ...prev, spaces: prev.spaces.map(s => s.id === space.id ? { ...s, area_target: val } : s) }
                        })
                      }}
                      style={{ padding: '8px', fontSize: 13, borderRadius: 4, border: '1px solid #ccc', width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>單元關聯 — 正相關</label>
                    <select
                      multiple
                      value={(space.relations?.positive) || []}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions).map(o => o.value)
                        setSpec(prev => {
                          if (!prev) return prev
                          return { ...prev, spaces: prev.spaces.map(s => s.id === space.id ? { ...s, relations: { ...(s.relations || { positive: [], negative: [] }), positive: selected } } : s) }
                        })
                      }}
                      style={{ width: '100%', minHeight: 54, fontSize: 13 }}
                    >
                      {spec?.spaces.filter(s => s.id !== space.id).map(s => (
                        <option key={s.id} value={s.id}>{s.name ?? s.id}</option>
                      ))}
                    </select>
                    {/* selected chips, wrap when many */}
                    <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(space.relations?.positive || []).map(pid => {
                        const item = spec?.spaces.find(ss => ss.id === pid)
                        return <div key={pid} style={{ background: '#eef6ff', padding: '4px 8px', borderRadius: 12, fontSize: 12 }}>{item?.name ?? pid}</div>
                      })}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>負相關</label>
                    <select
                      multiple
                      value={(space.relations?.negative) || []}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions).map(o => o.value)
                        setSpec(prev => {
                          if (!prev) return prev
                          return { ...prev, spaces: prev.spaces.map(s => s.id === space.id ? { ...s, relations: { ...(s.relations || { positive: [], negative: [] }), negative: selected } } : s) }
                        })
                      }}
                      style={{ width: '100%', minHeight: 54, fontSize: 13 }}
                    >
                      {spec?.spaces.filter(s => s.id !== space.id).map(s => (
                        <option key={s.id} value={s.id}>{s.name ?? s.id}</option>
                      ))}
                    </select>
                    <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(space.relations?.negative || []).map(pid => {
                        const item = spec?.spaces.find(ss => ss.id === pid)
                        return <div key={pid} style={{ background: '#fff3f0', padding: '4px 8px', borderRadius: 12, fontSize: 12 }}>{item?.name ?? pid}</div>
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Keep copy share button and selected info */}
        <div style={{ marginTop: 12 }}>
          <button onClick={copyShareLink} style={{ width: '100%', padding: '8px 12px', fontSize: 12, cursor: 'pointer', borderRadius: 3, border: '1px solid #999', backgroundColor: '#f5f5f5' }}>Copy Share Link</button>
        </div>

        {selectedNode && (
          <div style={{ marginTop: 12, padding: 8, backgroundColor: '#f0f0f0', borderRadius: 3, fontSize: 11 }}>
            <strong>Selected:</strong>
            <div>id: {selectedNode.id}</div>
            <div>name: {selectedNode.name}</div>
            <div>area: {selectedNode.area_target}</div>
            <div>zone: {selectedNode.zone}</div>
          </div>
        )}
      </aside>

      {/* Middle Column: Bubble Graph */}
      <main className="main" ref={centerColumnRef}>
        <div className="graphWrap" ref={graphWrapRef}>
          <div style={{position:'absolute', top: 8, left: 8, fontSize: 12, zIndex: 10}}>
            {containerDimensions.width} x {containerDimensions.height}
          </div>
          <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 100 }}>
            <button
              onClick={resetLayout}
              style={{
                padding: '8px 12px',
                fontSize: 12,
                cursor: 'pointer',
                borderRadius: 3,
                border: '1px solid #666',
                backgroundColor: '#f5f5f5',
                fontWeight: 500,
              }}
            >
              Reset Layout
            </button>
          </div>
          {containerDimensions.width > 0 && containerDimensions.height > 0 ? (
            <ForceGraph2D
              ref={fgRef}
              width={containerDimensions.width}
              height={containerDimensions.height}
              graphData={graphData as any}
          nodeLabel={(node: any) => `${node.name}\narea: ${node.area_target}`}
          nodeCanvasObject={(node: any, ctx, globalScale) => {
            const radius = getNodeRadius(node)
            const isHovered = hoveredNodeId === node.id
            const isSelected = selectedNode?.id === node.id
            const isNeighbor = hoveredNodeId && getNeighbors(hoveredNodeId).has(node.id)
            
            ctx.beginPath()
            ctx.fillStyle = isHovered || isSelected ? '#ff6b6b' : (isNeighbor ? '#ffa500' : zoneColor[node.zone] || '#ccc')
            ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false)
            ctx.fill()
            
            if (isHovered || isSelected) {
              ctx.strokeStyle = '#333'
              ctx.lineWidth = 2
              ctx.stroke()
            }
            
            // label with background
            const label = node.name
            ctx.font = `${12 / globalScale}px Sans-Serif`
            const metrics = ctx.measureText(label)
            const labelX = node.x
            const labelY = node.y - radius - 12
            
            // white background for label
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
            ctx.fillRect(labelX - metrics.width / 2 - 4, labelY - 10, metrics.width + 8, 14)
            
            ctx.fillStyle = '#000'
            ctx.textAlign = 'center'
            ctx.fillText(label, labelX, labelY)
          }}
          linkWidth={(link: any) => Math.max(1, (link.weight || 1) * 2)}
          linkColor={(link: any) => {
            if (hoveredNodeId && (link.source.id === hoveredNodeId || link.target.id === hoveredNodeId)) {
              return '#ff6b6b'
            }
            return linkStyle(link.type).color
          }}
          linkCanvasObject={(link: any, ctx) => {
            const sourceX = link.source.x
            const sourceY = link.source.y
            const targetX = link.target.x
            const targetY = link.target.y
            ctx.save()
            const isHighlighted = hoveredNodeId && (link.source.id === hoveredNodeId || link.target.id === hoveredNodeId)
            const style = linkStyle(link.type)
            ctx.strokeStyle = isHighlighted ? '#ff6b6b' : style.color
            ctx.globalAlpha = isHighlighted ? 1 : (hoveredNodeId ? 0.2 : 1)
            ctx.lineWidth = Math.max(1, (link.weight || 1) * 2)
            ctx.setLineDash(style.dash as number[])
            ctx.beginPath()
            ctx.moveTo(sourceX, sourceY)
            ctx.lineTo(targetX, targetY)
            ctx.stroke()
            ctx.restore()
          }}
          onNodeHover={(node: any) => {
            setHoveredNodeId(node?.id ?? null)
          }}
          onNodeClick={(node: any) => {
            setSelectedNode({
              id: node.id,
              name: node.name,
              area_target: node.area_target,
              zone: node.zone,
            })
          }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%' }} />
          )}
        </div>
      </main>

      {/* Right Column: Analytical Dashboard */}
      <aside className="panelRight">
        <div className="dashboard-panel">
          <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600 }}>Analytical Dashboard</h3>

          {/* Summary Section */}
          <div className="dashboard-section">
            <h4 style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 600, color: '#333' }}>Summary</h4>
            <div style={{ fontSize: 11, color: '#666', lineHeight: 1.6, padding: '8px', backgroundColor: '#fff', borderRadius: 3, border: '1px solid #e0e0e0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span>房型：</span><strong>{formData.roomType}房</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span>Spaces：</span><strong>{spec?.spaces.length || 0}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span>Edges：</span><strong>{spec?.edges.length || 0}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>總面積：</span><strong>{dashboardData.totalArea.toFixed(1)} m²</strong></div>
            </div>
          </div>

          {/* Room Areas Section */}
          <div className="dashboard-section">
            <h4 style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 600, color: '#333' }}>Room Areas</h4>
            <div style={{ fontSize: 10, color: '#666', lineHeight: 1.8, padding: '8px', backgroundColor: '#fff', borderRadius: 3, border: '1px solid #e0e0e0' }}>
              {['public', 'private', 'service'].map((zone) => {
                const spaces = dashboardData.spacesByZone[zone] || []
                if (spaces.length === 0) return null
                const zoneLabel = zone === 'public' ? '公共區' : zone === 'private' ? '私人區' : '服務區'
                const zoneColor = zone === 'public' ? '#6fa8dc' : zone === 'private' ? '#ffd966' : '#b6d7a8'
                return (
                  <div key={zone} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #eee' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#333', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ display: 'inline-block', width: 10, height: 10, backgroundColor: zoneColor, borderRadius: '50%' }} />
                      {zoneLabel}
                    </div>
                    {spaces.map((space) => (
                      <div key={space.id} style={{ display: 'flex', justifyContent: 'space-between', marginLeft: 16 }}>
                        <span>{space.name}</span>
                        <strong>{space.area_target.toFixed(1)} m²</strong>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>

          {/* External Conditions Section */}
          <div className="dashboard-section">
            <h4 style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 600, color: '#333' }}>External Conditions</h4>
            <div style={{ fontSize: 10, color: '#666', lineHeight: 1.8, padding: '8px', backgroundColor: '#fff', borderRadius: 3, border: '1px solid #e0e0e0' }}>
              {Object.entries(dashboardData.conditionTags).map(([key, data]) => {
                const labels: Record<string, string> = { scenicView: '景觀面', noiseControl: '噪音面', ventilation: '通風面' }
                return (
                  <div key={key} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #eee' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ display: 'inline-block', width: 12, height: 12, backgroundColor: data.active ? '#4CAF50' : '#ddd', borderRadius: 2 }} />
                      <strong>{labels[key]}：</strong>
                      <span style={{ color: data.active ? '#4CAF50' : '#999' }}>{data.active ? '有' : '無'}</span>
                    </div>
                    {data.active && (
                      <div style={{ marginLeft: 18, fontSize: 9, color: '#888', fontStyle: 'italic' }}>
                        Tag: <strong style={{ color: '#333' }}>'{data.tag}'</strong>
                        <div>{data.strategy}</div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Legend Section */}
          <div className="dashboard-section">
            <h4 style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 600, color: '#333' }}>Legend</h4>
            <div style={{ fontSize: 10, color: '#666', lineHeight: 1.8, padding: '8px', backgroundColor: '#fff', borderRadius: 3, border: '1px solid #e0e0e0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ display: 'inline-block', width: 12, height: 12, backgroundColor: '#6fa8dc', borderRadius: '50%' }} />
                <span>Public Zone</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ display: 'inline-block', width: 12, height: 12, backgroundColor: '#ffd966', borderRadius: '50%' }} />
                <span>Private Zone</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', width: 12, height: 12, backgroundColor: '#b6d7a8', borderRadius: '50%' }} />
                <span>Service Zone</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {toast && (
        <div style={{
          position: 'fixed',
          top: 16,
          right: 16,
          backgroundColor: '#333',
          color: '#fff',
          padding: '12px 16px',
          borderRadius: 4,
          fontSize: 14,
          zIndex: 9999,
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}

export default App
