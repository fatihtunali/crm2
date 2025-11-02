'use client';

import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-200 bg-gray-50 px-8 py-4">
        <h1 className="text-2xl font-bold text-gray-900">CRM API Documentation</h1>
        <p className="text-gray-600 mt-1">Complete API reference for all endpoints</p>
      </div>
      <SwaggerUI url="/swagger.yaml" />
    </div>
  );
}
