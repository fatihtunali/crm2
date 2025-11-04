'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

interface Money {
  amount_minor: number;
  currency: string;
}

interface ProfitLossReport {
  period: {
    start_date: string;
    end_date: string;
  };
  revenue: {
    tourRevenue: Money;
    serviceRevenue: Money;
    otherRevenue: Money;
    totalRevenue: Money;
  };
  costOfServices: {
    hotelCosts: Money;
    transportCosts: Money;
    guideCosts: Money;
    entranceFeeCosts: Money;
    otherCosts: Money;
    totalCostOfServices: Money;
  };
  grossProfit: Money;
  grossMargin: number;
  operatingExpenses: {
    salaries: Money;
    marketing: Money;
    technology: Money;
    administrative: Money;
    totalOperatingExpenses: Money;
  };
  netProfit: Money;
  netMargin: number;
}

function formatMoney(money: Money | undefined): string {
  if (!money) return '€0.00';
  const amount = money.amount_minor / 100;
  return `€${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ProfitLossPage() {
  const { organizationId } = useAuth();
  const [data, setData] = useState<ProfitLossReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('this_year');

  useEffect(() => {
    if (organizationId) {
      fetchData();
    }
  }, [organizationId, dateRange]);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `/api/reports/financial/profit-loss?period=${dateRange}`,
        {
          headers: {
            'X-Tenant-Id': organizationId
          }
        }
      );
      
      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const result = await res.json();
      setData(result.data || null);
    } catch (error) {
      console.error('Failed to fetch:', error);
      setError('Failed to load report. Please try again.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-8">
        <Link href="/reports" className="text-primary-600 hover:text-primary-700 text-sm mb-2 inline-block">
          Back to Reports
        </Link>
        <div className="mt-8 bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-red-800 font-semibold mb-2">Error Loading Report</h3>
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8">
        <Link href="/reports" className="text-primary-600 hover:text-primary-700 text-sm mb-2 inline-block">
          Back to Reports
        </Link>
        <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Data Available</h3>
          <p className="text-gray-600 mb-6">
            There is no data for the selected period. Create some bookings and quotations to see reports.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/quotations"
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Create Quotation
            </Link>
            <button
              onClick={fetchData}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/reports" className="text-primary-600 hover:text-primary-700 text-sm mb-2 inline-block">
          ← Back to Reports
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Profit & Loss Report</h1>
            <p className="text-gray-500 mt-1">Detailed P&L statement</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              📄 Export PDF
            </button>
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-white rounded-lg shadow-sm p-4">
        <div className="flex gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time Period</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="this_month">This Month</option>
              <option value="this_quarter">This Quarter</option>
              <option value="this_year">This Year</option>
              <option value="last_year">Last Year</option>
            </select>
          </div>
        </div>
      </div>

      {/* P&L Statement */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-4 font-semibold text-gray-700">Account</th>
              <th className="text-right p-4 font-semibold text-gray-700">Amount</th>
              <th className="text-right p-4 font-semibold text-gray-700">% of Revenue</th>
            </tr>
          </thead>
          <tbody>
            {/* Revenue Section */}
            <tr className="bg-primary-50 font-semibold">
              <td className="p-4 text-gray-900">REVENUE</td>
              <td className="p-4"></td>
              <td className="p-4"></td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="p-4 pl-8 text-gray-700">Tour Revenue</td>
              <td className="p-4 text-right text-gray-900">{formatMoney(data.revenue.tourRevenue)}</td>
              <td className="p-4 text-right text-gray-600">
                {((data.revenue.tourRevenue.amount_minor / data.revenue.totalRevenue.amount_minor) * 100).toFixed(1)}%
              </td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="p-4 pl-8 text-gray-700">Service Revenue</td>
              <td className="p-4 text-right text-gray-900">{formatMoney(data.revenue.serviceRevenue)}</td>
              <td className="p-4 text-right text-gray-600">
                {((data.revenue.serviceRevenue.amount_minor / data.revenue.totalRevenue.amount_minor) * 100).toFixed(1)}%
              </td>
            </tr>
            <tr className="border-b border-gray-200">
              <td className="p-4 pl-8 text-gray-700">Other Revenue</td>
              <td className="p-4 text-right text-gray-900">{formatMoney(data.revenue.otherRevenue)}</td>
              <td className="p-4 text-right text-gray-600">
                {((data.revenue.otherRevenue.amount_minor / data.revenue.totalRevenue.amount_minor) * 100).toFixed(1)}%
              </td>
            </tr>
            <tr className="bg-gray-50 font-bold">
              <td className="p-4 text-gray-900">Total Revenue</td>
              <td className="p-4 text-right text-primary-600">{formatMoney(data.revenue.totalRevenue)}</td>
              <td className="p-4 text-right text-gray-900">100.0%</td>
            </tr>

            {/* Cost of Services Section */}
            <tr className="bg-red-50 font-semibold">
              <td className="p-4 text-gray-900">COST OF SERVICES</td>
              <td className="p-4"></td>
              <td className="p-4"></td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="p-4 pl-8 text-gray-700">Hotel Costs</td>
              <td className="p-4 text-right text-gray-900">{formatMoney(data.costOfServices.hotelCosts)}</td>
              <td className="p-4 text-right text-gray-600">
                {((data.costOfServices.hotelCosts.amount_minor / data.revenue.totalRevenue.amount_minor) * 100).toFixed(1)}%
              </td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="p-4 pl-8 text-gray-700">Transport Costs</td>
              <td className="p-4 text-right text-gray-900">{formatMoney(data.costOfServices.transportCosts)}</td>
              <td className="p-4 text-right text-gray-600">
                {((data.costOfServices.transportCosts.amount_minor / data.revenue.totalRevenue.amount_minor) * 100).toFixed(1)}%
              </td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="p-4 pl-8 text-gray-700">Guide Costs</td>
              <td className="p-4 text-right text-gray-900">{formatMoney(data.costOfServices.guideCosts)}</td>
              <td className="p-4 text-right text-gray-600">
                {((data.costOfServices.guideCosts.amount_minor / data.revenue.totalRevenue.amount_minor) * 100).toFixed(1)}%
              </td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="p-4 pl-8 text-gray-700">Entrance Fee Costs</td>
              <td className="p-4 text-right text-gray-900">{formatMoney(data.costOfServices.entranceFeeCosts)}</td>
              <td className="p-4 text-right text-gray-600">
                {((data.costOfServices.entranceFeeCosts.amount_minor / data.revenue.totalRevenue.amount_minor) * 100).toFixed(1)}%
              </td>
            </tr>
            <tr className="border-b border-gray-200">
              <td className="p-4 pl-8 text-gray-700">Other Direct Costs</td>
              <td className="p-4 text-right text-gray-900">{formatMoney(data.costOfServices.otherCosts)}</td>
              <td className="p-4 text-right text-gray-600">
                {((data.costOfServices.otherCosts.amount_minor / data.revenue.totalRevenue.amount_minor) * 100).toFixed(1)}%
              </td>
            </tr>
            <tr className="bg-gray-50 font-bold">
              <td className="p-4 text-gray-900">Total Cost of Services</td>
              <td className="p-4 text-right text-red-600">{formatMoney(data.costOfServices.totalCostOfServices)}</td>
              <td className="p-4 text-right text-gray-900">
                {((data.costOfServices.totalCostOfServices.amount_minor / data.revenue.totalRevenue.amount_minor) * 100).toFixed(1)}%
              </td>
            </tr>

            {/* Gross Profit */}
            <tr className="bg-green-50 font-bold text-lg">
              <td className="p-4 text-gray-900">GROSS PROFIT</td>
              <td className="p-4 text-right text-green-600">{formatMoney(data.grossProfit)}</td>
              <td className="p-4 text-right text-green-600">{data.grossMargin.toFixed(1)}%</td>
            </tr>

            {/* Operating Expenses */}
            <tr className="bg-yellow-50 font-semibold">
              <td className="p-4 text-gray-900">OPERATING EXPENSES</td>
              <td className="p-4"></td>
              <td className="p-4"></td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="p-4 pl-8 text-gray-700">Salaries & Benefits</td>
              <td className="p-4 text-right text-gray-900">{formatMoney(data.operatingExpenses.salaries)}</td>
              <td className="p-4 text-right text-gray-600">
                {((data.operatingExpenses.salaries.amount_minor / data.revenue.totalRevenue.amount_minor) * 100).toFixed(1)}%
              </td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="p-4 pl-8 text-gray-700">Marketing & Sales</td>
              <td className="p-4 text-right text-gray-900">{formatMoney(data.operatingExpenses.marketing)}</td>
              <td className="p-4 text-right text-gray-600">
                {((data.operatingExpenses.marketing.amount_minor / data.revenue.totalRevenue.amount_minor) * 100).toFixed(1)}%
              </td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="p-4 pl-8 text-gray-700">Technology & Software</td>
              <td className="p-4 text-right text-gray-900">{formatMoney(data.operatingExpenses.technology)}</td>
              <td className="p-4 text-right text-gray-600">
                {((data.operatingExpenses.technology.amount_minor / data.revenue.totalRevenue.amount_minor) * 100).toFixed(1)}%
              </td>
            </tr>
            <tr className="border-b border-gray-200">
              <td className="p-4 pl-8 text-gray-700">Administrative</td>
              <td className="p-4 text-right text-gray-900">{formatMoney(data.operatingExpenses.administrative)}</td>
              <td className="p-4 text-right text-gray-600">
                {((data.operatingExpenses.administrative.amount_minor / data.revenue.totalRevenue.amount_minor) * 100).toFixed(1)}%
              </td>
            </tr>
            <tr className="bg-gray-50 font-bold">
              <td className="p-4 text-gray-900">Total Operating Expenses</td>
              <td className="p-4 text-right text-red-600">{formatMoney(data.operatingExpenses.totalOperatingExpenses)}</td>
              <td className="p-4 text-right text-gray-900">
                {((data.operatingExpenses.totalOperatingExpenses.amount_minor / data.revenue.totalRevenue.amount_minor) * 100).toFixed(1)}%
              </td>
            </tr>

            {/* Net Profit */}
            <tr className="bg-primary-100 font-bold text-xl">
              <td className="p-6 text-gray-900">NET PROFIT</td>
              <td className="p-6 text-right text-primary-600">{formatMoney(data.netProfit)}</td>
              <td className="p-6 text-right text-primary-600">{data.netMargin.toFixed(1)}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-primary-500">
          <div className="text-sm text-gray-500 mb-1">Total Revenue</div>
          <div className="text-3xl font-bold text-gray-900">{formatMoney(data.revenue.totalRevenue)}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
          <div className="text-sm text-gray-500 mb-1">Gross Profit Margin</div>
          <div className="text-3xl font-bold text-green-600">{data.grossMargin.toFixed(1)}%</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-purple-500">
          <div className="text-sm text-gray-500 mb-1">Net Profit Margin</div>
          <div className="text-3xl font-bold text-purple-600">{data.netMargin.toFixed(1)}%</div>
        </div>
      </div>
    </div>
  );
}
