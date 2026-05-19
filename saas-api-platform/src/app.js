const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const { globalRateLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

// Routes
const authRoutes = require('./routes/auth.routes');
const orgRoutes = require('./routes/org.routes');
const apiKeyRoutes = require('./routes/apiKey.routes');
const billingRoutes = require('./routes/billing.routes');
const usageRoutes = require('./routes/usage.routes');
const webhookRoutes = require('./routes/webhook.routes');

const app = express();

// ===== SECURITY MIDDLEWARE =====
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
}));

// ===== STRIPE WEBHOOK (raw body needed) =====
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));

// ===== BODY PARSING =====
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// ===== LOGGING =====
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) }
}));

// ===== RATE LIMITING =====
app.use('/api/', globalRateLimiter);

// ===== HEALTH CHECK =====
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV,
  });
});

// ===== API DOCS =====
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'SaaS API Platform - Docs',
}));

// ===== ROUTES =====
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/orgs', orgRoutes);
app.use('/api/v1/api-keys', apiKeyRoutes);
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/usage', usageRoutes);
app.use('/api/webhooks', webhookRoutes);

// ===== ERROR HANDLING =====
app.use(notFound);
app.use(errorHandler);

module.exports = app;
