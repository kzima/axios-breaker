import axios from 'axios';
import * as rax from 'retry-axios';
const http = require('http');
const https = require('https');
import BorneCircuitBreaker from './lib/borneCircuitBreaker';
module.exports = {
    ajaxInstance: (breakerConfig) => {
      const axiosAgent = axios.create({
        httpAgent: new http.Agent({
          keepAlive: true
        }),
        httpsAgent: new https.Agent({
          rejectUnauthorized: false,
          keepAlive: true,
          https: true
        })
      });
  
      axiosAgent.defaults.raxConfig = {
        retry: breakerConfig.retry || 3,
        noResponseRetries: breakerConfig.noResponseRetries || 2,
        retryDelay: breakerConfig.retryDelay || 100,
        httpMethodsToRetry: ['GET', 'POST', 'HEAD', 'OPTIONS', 'DELETE', 'PUT','PATCH'],
        statusCodesToRetry: [
          [100, 199],
          [419, 429],
          [500, 599]
        ],
        onRetryAttempt: retryErr => {
          const cfg = rax.getConfig(retryErr);
          console.error(
            '\n\n\n\n\n=================== Retry on error ' +
              cfg.currentRetryAttempt,
              retryErr
          );
        },
        instance: axiosAgent
      };
  
      // intercept the axios request.
      axiosAgent.interceptors.request.use(
         config => {
          try {
              config.adapter = async(config) =>{
              async function proxyCall(){
                const response= await axios({
                  url:config.url,
                  method:config.method,
                  data:config.data,
                  header:config.headers
                });
                return  Promise.resolve(response);
              }
                const breaker = new BorneCircuitBreaker(proxyCall,breakerConfig.options);
                return breaker.exec();
                  
              };
              return {
                ...config,
                headers: {
                  ...config.headers,
                  customHeader: 'Overirding the proxy call'
                }
              };
          } catch (err) {
            logger.error('Cache Error:', err);
            return config;
          }
        },
        function(error) {
          logger.error('Error before sending request', error);
          return Promise.reject(error);
        }
      );
      // intercept the axios request.
      axiosAgent.interceptors.response.use(
        function(response) {
          return response;
        },
        function(error) {
          if (error.statusCode >= 300) {
            logger.error('Response Error: ', error);
          }
          return Promise.reject(error);
        }
      );
  
      return axiosAgent;
    }
}