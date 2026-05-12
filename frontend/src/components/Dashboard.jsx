import { useEffect, useState } from 'react'
import React from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  Legend,
} from 'recharts'

const ODOO_BASE_URL = import.meta.env.VITE_ODOO_URL || ""

/**
 * Convert seconds to a human-readable duration format
 * e.g., "4 days, 2 hrs", "Under 1 hour"
 */
function formatDuration(seconds) {
  if (!seconds || seconds < 0) return 'N/A'
  
  const units = [
    { name: 'day', divisor: 86400 },
    { name: 'hr', divisor: 3600 },
    { name: 'min', divisor: 60 },
  ]
  
  let remaining = seconds
  const parts = []
  
  for (const unit of units) {
    const value = Math.floor(remaining / unit.divisor)
    if (value > 0) {
      parts.push(`${value} ${unit.name}${value > 1 ? 's' : ''}`)
      remaining %= unit.divisor
    }
  }
  
  if (parts.length === 0) {
    return 'Under 1 min'
  }
  
  return parts.slice(0, 2).join(', ')
}

function formatOdooDate(dateString) {
  if (!dateString) return ''
  const date = new Date(`${dateString}Z`)
  return date.toLocaleString()
}

/**
 * Timeline component to display stage history for a single lead
 */
function StageTimeline({ history }) {
  return (
    <div className="space-y-4">
      {history.map((entry, idx) => (
        <div key={idx} className="flex gap-4">
          {/* Timeline line and dot */}
          <div className="flex flex-col items-center">
            <div className="w-4 h-4 rounded-full bg-emerald-400 ring-2 ring-slate-700"></div>
            {idx < history.length - 1 && (
              <div className="w-0.5 h-16 bg-slate-700 mt-1"></div>
            )}
          </div>
          
          {/* Stage info */}
          <div className="pb-4 flex-1">
            <div className="font-semibold text-white">{entry.stage_name}</div>
            <div className="text-sm text-slate-300">
              Entered: {formatOdooDate(entry.entered_at)}
            </div>
            {entry.time_in_stage_seconds !== null && (
              <div className="text-sm font-medium text-emerald-300 mt-1">
                Duration: {formatDuration(entry.time_in_stage_seconds)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedRowId, setExpandedRowId] = useState(null)
  const [selectedSalesperson, setSelectedSalesperson] = useState('All')
  const [selectedStage, setSelectedStage] = useState('All')
  const [dateRange, setDateRange] = useState({ from: '', to: '' })
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' })
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 25

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        setLoading(true)
        const apiBase = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
        const response = await fetch(`${apiBase}/api/leads`)
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`)
        }
        
        const data = await response.json()
        setLeads(data.leads || [])
        setError(null)
      } catch (err) {
        console.error('Failed to fetch leads:', err)
        setError(err.message)
        setLeads([])
      } finally {
        setLoading(false)
      }
    }

    fetchLeads()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-slate-200">
        <div className="text-lg">Loading leads...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-slate-200">
        <div className="text-lg text-rose-400">Error: {error}</div>
      </div>
    )
  }

  const salespeople = Array.from(new Set(leads.map((lead) => lead.salesperson_name || 'Unassigned'))).sort()
  const stages = Array.from(new Set(leads.map((lead) => lead.current_stage_name || 'Unknown'))).sort()
  const filteredLeads = leads.filter((lead) => {
    const salespersonMatch = selectedSalesperson === 'All' || (lead.salesperson_name || 'Unassigned') === selectedSalesperson
    const stageMatch = selectedStage === 'All' || (lead.current_stage_name || 'Unknown') === selectedStage

    let createDate = null
    if (lead.create_date) {
      createDate = new Date(`${lead.create_date}Z`)
    }

    const fromMatch = !dateRange.from || (createDate && !isNaN(createDate.getTime()) && createDate.getTime() >= new Date(`${dateRange.from}T00:00:00`).getTime())
    const toMatch = !dateRange.to || (createDate && !isNaN(createDate.getTime()) && createDate.getTime() <= new Date(`${dateRange.to}T23:59:59`).getTime())

    return salespersonMatch && stageMatch && fromMatch && toMatch
  })

  // Enrich filteredLeads with total_cycle_seconds
  filteredLeads.forEach((lead) => {
    let cycleSeconds = 0;
    if (lead?.stage_history?.length > 0) {
      const start = new Date(lead.stage_history[0].entered_at + 'Z').getTime();
      const end = new Date(lead.stage_history[lead.stage_history.length - 1].entered_at + 'Z').getTime();
      if (!isNaN(start) && !isNaN(end)) {
        cycleSeconds = (end - start) / 1000;
      }
    }
    lead.total_cycle_seconds = Math.max(0, cycleSeconds);
  });


  const cycleTimes = filteredLeads
    .map((lead) => {
      const history = lead.stage_history || []
      if (!history.length || !lead.create_date) return null
      const last = history[history.length - 1]
      if (!last.entered_at) return null
      const createDate = new Date(`${lead.create_date}Z`)
      const currentStageDate = new Date(`${last.entered_at}Z`)
      const diff = currentStageDate.getTime() - createDate.getTime()
      return Number.isFinite(diff) ? Math.max(0, Math.round(diff / 1000)) : null
    })
    .filter((seconds) => seconds !== null)

  const averageCycleSeconds = cycleTimes.length
    ? Math.round(cycleTimes.reduce((sum, value) => sum + value, 0) / cycleTimes.length)
    : null

  const totalLeads = filteredLeads.length
  const averageCycleDisplay = averageCycleSeconds !== null ? formatDuration(averageCycleSeconds) : 'N/A'

  let fastestTimeSeconds = Infinity
  let fastestLeadName = 'N/A'

  let slowestTimeSeconds = 0;
  let slowestLeadName = "N/A";

  if (Array.isArray(filteredLeads)) {
    filteredLeads.forEach((lead) => {
      try {
        if (lead?.stage_history?.length > 0) {
          const firstStage = lead.stage_history[0]
          const lastStage = lead.stage_history[lead.stage_history.length - 1]

          if (firstStage?.entered_at && lastStage?.entered_at) {
            const start = new Date(firstStage.entered_at + 'Z').getTime()
            const end = new Date(lastStage.entered_at + 'Z').getTime()

            if (!isNaN(start) && !isNaN(end)) {
              const cycleSeconds = (end - start) / 1000
              if (cycleSeconds > 0 && cycleSeconds < fastestTimeSeconds) {
                fastestTimeSeconds = cycleSeconds
                fastestLeadName = lead.name || 'Unknown Lead'
              }
              if (cycleSeconds > slowestTimeSeconds) {
                slowestTimeSeconds = cycleSeconds;
                slowestLeadName = lead.name || "Unknown Lead";
              }
            }
          }
        }
      } catch (err) {
        console.error('Error calculating lead timeline:', err)
      }
    })
  }

  const displayFastestTime = fastestTimeSeconds === Infinity
    ? 'N/A'
    : formatDuration(fastestTimeSeconds)

  const displaySlowestTime = slowestTimeSeconds === 0 ? "N/A" : formatDuration(slowestTimeSeconds);

  const getSortValue = (lead, key) => {
    switch (key) {
      case 'id':
        return Number.isFinite(Number(lead.id)) ? Number(lead.id) : lead.id || 0
      case 'name':
        return lead.name?.toString().toLowerCase() || ''
      case 'salesperson_name':
        return lead.salesperson_name?.toString().toLowerCase() || ''
      case 'current_stage_name':
        return lead.current_stage_name?.toString().toLowerCase() || ''
      case 'create_date':
        return lead.create_date ? new Date(`${lead.create_date}Z`).getTime() : 0
      case 'total_cycle_seconds':
        return lead.total_cycle_seconds || 0
      default:
        return ''
    }
  }

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <span className="text-slate-400">⇅</span>
    }
    return (
      <span className="text-slate-200">{sortConfig.direction === 'ascending' ? '▲' : '▼'}</span>
    )
  }

  const sortedLeads = [...filteredLeads].sort((a, b) => {
    if (!sortConfig.key) return 0
    const aValue = getSortValue(a, sortConfig.key)
    const bValue = getSortValue(b, sortConfig.key)

    if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1
    if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1
    return 0
  })

  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentItems = sortedLeads.slice(indexOfFirstItem, indexOfLastItem)

  const handleSort = (key) => {
    setSortConfig((current) => {
      if (current.key === key) {
        return {
          key,
          direction: current.direction === 'ascending' ? 'descending' : 'ascending',
        }
      }
      return { key, direction: 'ascending' }
    })
    setCurrentPage(1)
  }

  const stageDistributionData = Object.entries(
    sortedLeads.reduce((acc, lead) => {
      const stage = lead.current_stage_name || 'Unknown'
      acc[stage] = (acc[stage] || 0) + 1
      return acc
    }, {})
  ).map(([name, value]) => ({ name, value }))

  const cycleTimeByRepData = Object.entries(
    sortedLeads.reduce((acc, lead) => {
      const rep = lead.salesperson_name || 'Unassigned'
      const history = lead.stage_history || []
      if (!history.length || !lead.create_date) {
        if (!acc[rep]) {
          acc[rep] = { totalSeconds: 0, count: 0 }
        }
        return acc
      }
      const last = history[history.length - 1]
      if (!last.entered_at) {
        if (!acc[rep]) {
          acc[rep] = { totalSeconds: 0, count: 0 }
        }
        return acc
      }
      const createDate = new Date(`${lead.create_date}Z`)
      const currentStageDate = new Date(`${last.entered_at}Z`)
      const diff = currentStageDate.getTime() - createDate.getTime()
      const seconds = Number.isFinite(diff) ? Math.max(0, Math.round(diff / 1000)) : 0

      if (!acc[rep]) {
        acc[rep] = { totalSeconds: 0, count: 0 }
      }
      acc[rep].totalSeconds += seconds
      acc[rep].count += 1
      return acc
    }, {})
  )
    .map(([name, data]) => ({
      name,
      avgDays: data.count > 0 ? (data.totalSeconds / 86400 / data.count).toFixed(1) : 0,
    }))

  const stageOutliers = new Set([
    'Parked',
    'For retargeting',
    'Unknown Stage',
    'DEPRECATED12 Payment Collection',
  ])

  const avgTimeByStageData = Object.entries(
    filteredLeads.reduce((acc, lead) => {
      const history = lead.stage_history || []
      history.forEach((stage) => {
        const stageName = stage.stage_name || 'Unknown'
        const duration = Number(stage.time_in_stage_seconds)
        if (!Number.isFinite(duration) || duration < 0) return

        if (!acc[stageName]) {
          acc[stageName] = { totalSeconds: 0, count: 0 }
        }
        acc[stageName].totalSeconds += duration
        acc[stageName].count += 1
      })
      return acc
    }, {})
  )
    .map(([name, data]) => ({
      name,
      avgDays: data.count > 0 ? Number((data.totalSeconds / 86400 / data.count).toFixed(1)) : 0,
    }))
    .filter((entry) => entry.name !== 'Created / 01 New Deals')
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))

  const sortedAvgTimeByStageData = [
    ...avgTimeByStageData.filter((entry) => !stageOutliers.has(entry.name)),
    ...avgTimeByStageData.filter((entry) => stageOutliers.has(entry.name)),
  ]

  const chartColors = ['#34d399', '#22d3ee', '#818cf8', '#a78bfa', '#f472b6', '#f59e0b']

  return (
    <div className="min-h-screen bg-slate-900 p-8 text-slate-200" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Odoo CRM Ageing Dashboard</h1>
        <p className="text-slate-300 mt-2">Tracking opportunities in target stages</p>
      </div>

      <div className="sticky top-0 z-30 backdrop-blur-xl bg-slate-900/80 border-b border-slate-700/50 py-4 mb-6 shadow-lg -mx-8 px-8 flex flex-wrap gap-4 items-end">
        <div className="min-w-[220px] bg-slate-800 p-5 rounded-2xl shadow-lg border border-slate-700">
          <p className="text-sm text-slate-400 uppercase tracking-wide">Salesperson</p>
          <select
            value={selectedSalesperson}
            onChange={(event) => {
              setSelectedSalesperson(event.target.value)
              setCurrentPage(1)
            }}
            className="mt-3 w-full rounded-xl border-slate-700 bg-slate-900 text-slate-200 px-4 py-3 text-sm shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
          >
            <option value="All">All</option>
            {salespeople.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        <div className="min-w-[220px] bg-slate-800 p-5 rounded-2xl shadow-lg border border-slate-700">
          <p className="text-sm text-slate-400 uppercase tracking-wide">Stage</p>
          <select
            value={selectedStage}
            onChange={(event) => {
              setSelectedStage(event.target.value)
              setCurrentPage(1)
            }}
            className="mt-3 w-full rounded-xl border-slate-700 bg-slate-900 text-slate-200 px-4 py-3 text-sm shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
          >
            <option value="All">All</option>
            {stages.map((stage) => (
              <option key={stage} value={stage}>{stage}</option>
            ))}
          </select>
        </div>

        <div className="min-w-[220px] bg-slate-800 p-5 rounded-2xl shadow-lg border border-slate-700">
          <p className="text-sm text-slate-400 uppercase tracking-wide">From</p>
          <input
            type="date"
            value={dateRange.from}
            onChange={(event) => {
              setDateRange((current) => ({ ...current, from: event.target.value }))
              setCurrentPage(1)
            }}
            className="mt-3 w-full rounded-xl border-slate-700 bg-slate-900 text-slate-200 px-4 py-3 text-sm shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
          />
        </div>

        <div className="min-w-[220px] bg-slate-800 p-5 rounded-2xl shadow-lg border border-slate-700">
          <p className="text-sm text-slate-400 uppercase tracking-wide">To</p>
          <input
            type="date"
            value={dateRange.to}
            onChange={(event) => {
              setDateRange((current) => ({ ...current, to: event.target.value }))
              setCurrentPage(1)
            }}
            className="mt-3 w-full rounded-xl border-slate-700 bg-slate-900 text-slate-200 px-4 py-3 text-sm shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
          />
        </div>
      </div>

      <div className="grid gap-4 mb-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="bg-slate-800 p-5 rounded-2xl shadow-lg border border-slate-700">
          <p className="text-sm text-slate-400 uppercase tracking-wide">Total Leads</p>
          <p className="mt-3 text-3xl font-semibold text-white">{totalLeads}</p>
        </div>

        <div className="bg-slate-800 p-5 rounded-2xl shadow-lg border border-slate-700">
          <p className="text-sm text-slate-400 uppercase tracking-wide">Fastest Cycle Time</p>
          <p className="mt-3 text-3xl font-semibold text-white">{displayFastestTime}</p>
          {fastestLeadName && fastestLeadName !== 'N/A' && (
            <p className="mt-2 text-sm text-slate-300">{fastestLeadName}</p>
          )}
        </div>

        <div className="bg-slate-800 p-5 rounded-2xl shadow-lg border border-slate-700">
          <p className="text-sm text-slate-400 uppercase tracking-wide">Slowest Cycle Time</p>
          <p className="mt-3 text-3xl font-semibold text-white">{displaySlowestTime}</p>
          {slowestLeadName && slowestLeadName !== 'N/A' && (
            <p className="mt-2 text-sm text-slate-300">{slowestLeadName}</p>
          )}
        </div>

        <div className="bg-slate-800 p-5 rounded-2xl shadow-lg border border-slate-700">
          <p className="text-sm text-slate-400 uppercase tracking-wide">Avg. Cycle Time (Creation to Execution)</p>
          <p className="mt-3 text-3xl font-semibold text-white">{averageCycleDisplay}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="text-lg font-semibold text-white">Leads by Stage</h3>
            {selectedStage !== 'All' && (
              <button
                type="button"
                onClick={() => {
                  setSelectedStage('All')
                  setCurrentPage(1)
                }}
                className="text-sm text-emerald-400 hover:underline"
              >
                Clear Filter
              </button>
            )}
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stageDistributionData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                onClick={(data) => {
                  if (data?.name) {
                    setSelectedStage(data.name)
                    setCurrentPage(1)
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                {stageDistributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => `${value} leads`}
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', borderRadius: '0.5rem' }}
              />
              <Legend
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
                wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="text-lg font-semibold text-white">Average Cycle Time by Salesperson (Days)</h3>
            {selectedSalesperson !== 'All' && (
              <button
                type="button"
                onClick={() => {
                  setSelectedSalesperson('All')
                  setCurrentPage(1)
                }}
                className="text-sm text-emerald-400 hover:underline"
              >
                Clear Filter
              </button>
            )}
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={cycleTimeByRepData} margin={{ top: 20, right: 30, left: 20, bottom: 70 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 12, fill: '#94a3b8' }} stroke="#94a3b8" />
              <YAxis label={{ value: 'Days', angle: -90, position: 'insideLeft', fill: '#94a3b8' }} tick={{ fill: '#94a3b8', fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip
                formatter={(value) => `${value} days`}
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', borderRadius: '0.5rem' }}
              />
              <Bar
                dataKey="avgDays"
                fill="#34d399"
                radius={[8, 8, 0, 0]}
                onClick={(data) => {
                  const clickedName = data?.name || data?.activeLabel
                  if (clickedName) {
                    setSelectedSalesperson(clickedName)
                    setCurrentPage(1)
                  }
                }}
                style={{ cursor: 'pointer' }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-700 mb-6">
        <h3 className="text-lg font-semibold text-white mb-4">Average Time in Each Stage (Days)</h3>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={sortedAvgTimeByStageData} margin={{ top: 20, right: 30, left: 20, bottom: 70 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 12, fill: '#94a3b8' }} stroke="#94a3b8" />
            <YAxis label={{ value: 'Days', angle: -90, position: 'insideLeft', fill: '#94a3b8' }} tick={{ fill: '#94a3b8', fontSize: 12 }} stroke="#94a3b8" />
            <Tooltip
              formatter={(value) => `${value} days`}
              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', borderRadius: '0.5rem' }}
            />
            <Bar dataKey="avgDays" fill="#22d3ee" radius={[8, 8, 0, 0]}>
              {sortedAvgTimeByStageData.map((entry, index) => (
                <Cell
                  key={`stage-cell-${index}`}
                  fill={stageOutliers.has(entry.name) ? '#64748b' : '#22d3ee'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {filteredLeads.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 text-slate-300">
          No leads found in target stages.
        </div>
      ) : (
        <div className="bg-slate-800 shadow-lg rounded-xl overflow-hidden border border-slate-700">
          <table className="min-w-full">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-700">
                <th
                  onClick={() => handleSort('id')}
                  className="sticky top-0 z-20 px-6 py-3 text-left text-sm font-semibold text-slate-400 cursor-pointer select-none backdrop-blur-md bg-slate-800/90 bg-clip-padding"
                >
                  <span className="inline-flex items-center gap-2">
                    <span>ID</span>
                    {renderSortIcon('id')}
                  </span>
                </th>
                <th className="sticky top-0 z-20 w-8 px-4 py-3 bg-slate-800/90 backdrop-blur-md"></th>
                <th
                  onClick={() => handleSort('name')}
                  className="sticky top-0 z-20 px-6 py-3 text-left text-sm font-semibold text-slate-400 cursor-pointer select-none backdrop-blur-md bg-slate-800/90 bg-clip-padding"
                >
                  <span className="inline-flex items-center gap-2">
                    <span>Lead Name</span>
                    {renderSortIcon('name')}
                  </span>
                </th>
                <th
                  onClick={() => handleSort('current_stage_name')}
                  className="sticky top-0 z-20 px-6 py-3 text-left text-sm font-semibold text-slate-400 cursor-pointer select-none backdrop-blur-md bg-slate-800/90 bg-clip-padding"
                >
                  <span className="inline-flex items-center gap-2">
                    <span>Current Stage</span>
                    {renderSortIcon('current_stage_name')}
                  </span>
                </th>
                <th
                  onClick={() => handleSort('total_cycle_seconds')}
                  className="sticky top-0 z-20 px-6 py-3 text-left text-sm font-semibold text-slate-400 cursor-pointer select-none backdrop-blur-md bg-slate-800/90 bg-clip-padding"
                >
                  <span className="inline-flex items-center gap-2">
                    <span>Cycle Time</span>
                    {renderSortIcon('total_cycle_seconds')}
                  </span>
                </th>
                <th
                  onClick={() => handleSort('salesperson_name')}
                  className="sticky top-0 z-20 px-6 py-3 text-left text-sm font-semibold text-slate-400 cursor-pointer select-none backdrop-blur-md bg-slate-800/90 bg-clip-padding"
                >
                  <span className="inline-flex items-center gap-2">
                    <span>Salesperson</span>
                    {renderSortIcon('salesperson_name')}
                  </span>
                </th>
                <th
                  onClick={() => handleSort('create_date')}
                  className="sticky top-0 z-20 px-6 py-3 text-left text-sm font-semibold text-slate-400 cursor-pointer select-none backdrop-blur-md bg-slate-800/90 bg-clip-padding"
                >
                  <span className="inline-flex items-center gap-2">
                    <span>Created Date</span>
                    {renderSortIcon('create_date')}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((lead, idx) => (
                <React.Fragment key={lead.id}>
                  <tr 
                    onClick={() => setExpandedRowId(expandedRowId === lead.id ? null : lead.id)}
                    className={`border-b border-slate-700 ${idx % 2 === 0 ? 'bg-slate-800' : 'bg-slate-900'} hover:bg-slate-700/50 cursor-pointer transition`}
                  >
                    <td className="px-6 py-4 text-sm font-mono">
                      <a
                        href={`${ODOO_BASE_URL}/web#id=${lead.id}&model=crm.lead&view_type=form`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:text-emerald-300 hover:underline transition-colors"
                        title="Open in Odoo"
                        onClick={(e) => e.stopPropagation()}
                      >
                        #{lead.id}
                      </a>
                    </td>
                    <td className="w-8 px-4 py-4 text-center">
                      <span className={`text-lg text-slate-300 transform transition-transform ${expandedRowId === lead.id ? 'rotate-180' : ''}`}>
                        ▼
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-200 font-medium">{lead.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-300">
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap shadow-[0_0_10px_rgba(52,211,153,0.1)]">
                        {lead.current_stage_name || (Array.isArray(lead.stage_id) ? lead.stage_id[1] : 'Unknown')}
                      </span>
                    </td>
                    <td className="text-slate-300 py-3 px-4 whitespace-nowrap">{lead.total_cycle_seconds > 0 ? formatDuration(lead.total_cycle_seconds) : "N/A"}</td>
                    <td className="px-6 py-4 text-sm text-slate-300">{lead.salesperson_name}</td>
                    <td className="px-6 py-4 text-sm text-slate-400">
                      {formatOdooDate(lead.create_date)}
                    </td>
                  </tr>
                  
                  {/* Expanded Timeline Row */}
                  {expandedRowId === lead.id && (
                    <tr className="bg-slate-900/50 border-b border-slate-700">
                      <td colSpan="6" className="px-6 py-6">
                        <div className="ml-8">
                          <h4 className="text-sm font-semibold text-white mb-4">Stage History Timeline</h4>
                          {lead.stage_history && lead.stage_history.length > 0 ? (
                            <StageTimeline history={lead.stage_history} />
                          ) : (
                            <p className="text-sm text-slate-400">No stage history available</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          <div className="flex justify-between items-center p-4 bg-slate-900 border-t border-slate-700">
            <div className="text-sm text-slate-400">
              Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, sortedLeads.length)} of {sortedLeads.length} entries
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded border border-slate-700 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === Math.ceil(sortedLeads.length / itemsPerPage)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded border border-slate-700 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

