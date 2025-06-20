const { YoutubeTranscript } = require('./dist/youtube-transcript.common.js');

async function testAllProxies() {
  console.log('🚀 Testing All Proxy Servers for YouTube Transcript Functionality...\n');
  
  // Your provided proxy list - all support HTTPS
  const proxies = [
    { 
      host: '51.81.245.3', 
      port: 17981, 
      type: 'Anonymous', 
      location: 'Unknown',
      status: 'recently checked OK'
    },
    { 
      host: '161.35.98.111', 
      port: 8080, 
      type: 'Elite', 
      location: 'DigitalOcean, North Bergen',
      status: 'checked working just now'
    },
    { 
      host: '136.52.10.221', 
      port: 8888, 
      type: 'Elite', 
      location: 'Irvine, CA',
      status: 'checked ~10 minutes ago'
    },
    { 
      host: '99.112.0.213', 
      port: 8080, 
      type: 'Elite', 
      location: 'Unknown',
      status: 'checked ~10 minutes ago'
    },
    { 
      host: '13.218.248.81', 
      port: 46172, 
      type: 'Elite', 
      location: 'Unknown',
      status: 'checked ~30 minutes ago'
    },
    { 
      host: '3.141.38.145', 
      port: 3128, 
      type: 'Elite', 
      location: 'Unknown',
      status: 'checked ~50 minutes ago'
    },
    { 
      host: '47.89.184.18', 
      port: 3128, 
      type: 'Anonymous', 
      location: 'Unknown',
      status: 'checked ~55 minutes ago'
    },
    { 
      host: '54.210.19.156', 
      port: 3128, 
      type: 'Elite', 
      location: 'Unknown',
      status: 'checked ~2½ hours ago'
    },
    { 
      host: '147.75.88.115', 
      port: 9443, 
      type: 'Elite', 
      location: 'Unknown',
      status: 'checked ~2½ hours ago'
    },
    { 
      host: '13.221.134.55', 
      port: 3128, 
      type: 'Elite', 
      location: 'Unknown',
      status: 'checked ~3 hours ago'
    }
  ];
  
  // Test videos - using your video that we know has transcripts
  const testVideoId = 'Zd7giOQfufw'; // Your video with 596 segments
  
  let workingProxies = [];
  let failedProxies = [];
  let results = [];
  
  console.log('📋 Proxy Server List:');
  proxies.forEach((proxy, index) => {
    console.log(`   ${index + 1}. ${proxy.host}:${proxy.port} (${proxy.type})`);
    console.log(`      Location: ${proxy.location}`);
    console.log(`      Status: ${proxy.status}`);
  });
  console.log();
  
  // Test each proxy individually
  for (let i = 0; i < proxies.length; i++) {
    const proxy = proxies[i];
    const proxyLabel = `${proxy.host}:${proxy.port}`;
    
    console.log(`🔍 Testing Proxy ${i + 1}/${proxies.length}: ${proxyLabel}`);
    console.log(`   Type: ${proxy.type} | Location: ${proxy.location}`);
    console.log(`   Status: ${proxy.status}`);
    
    const proxyConfig = {
      host: proxy.host,
      port: proxy.port,
      protocol: 'https' // All proxies support HTTPS
    };
    
    let testResult = {
      proxy: proxyLabel,
      ...proxy,
      working: false,
      responseTime: null,
      segments: 0,
      error: null,
      success: false
    };
    
    try {
      console.log('   📡 Connecting through proxy...');
      const startTime = Date.now();
      
      const transcript = await YoutubeTranscript.fetchTranscript(testVideoId, {
        lang: 'en',
        proxy: proxyConfig
      });
      
      const responseTime = Date.now() - startTime;
      testResult.responseTime = responseTime;
      testResult.segments = transcript.length;
      
      if (transcript && transcript.length > 0) {
        console.log(`   ✅ SUCCESS! ${transcript.length} transcript segments`);
        console.log(`   ⏱️  Response time: ${responseTime}ms`);
        console.log(`   🌍 Language: ${transcript[0].lang}`);
        console.log(`   📝 Sample: "${transcript[0].text.substring(0, 50)}${transcript[0].text.length > 50 ? '...' : ''}"`);
        
        testResult.working = true;
        testResult.success = true;
        workingProxies.push(testResult);
        
      } else {
        console.log(`   ⚠️  Connected but got 0 segments`);
        console.log(`   ⏱️  Response time: ${responseTime}ms`);
        testResult.error = 'No transcript segments returned';
        failedProxies.push(testResult);
      }
      
    } catch (error) {
      console.log(`   ❌ FAILED: ${error.message}`);
      
      testResult.error = error.message;
      failedProxies.push(testResult);
      
      // Categorize the error
      if (error.message.includes('ECONNREFUSED')) {
        console.log(`   💡 Connection refused - proxy may be offline`);
      } else if (error.message.includes('ENOTFOUND')) {
        console.log(`   💡 DNS lookup failed - proxy host not found`);
      } else if (error.message.includes('timeout')) {
        console.log(`   💡 Connection timeout - proxy is too slow`);
      } else if (error.message.includes('ECONNRESET')) {
        console.log(`   💡 Connection reset - proxy rejected the request`);
      } else if (error.message.includes('Transcript is disabled')) {
        console.log(`   💡 Video transcripts are disabled (not a proxy issue)`);
      } else {
        console.log(`   💡 Other error - ${error.message}`);
      }
    }
    
    results.push(testResult);
    console.log(); // Empty line for readability
    
    // Small delay between tests to be respectful to proxies
    if (i < proxies.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Comprehensive Results Summary
  console.log('═'.repeat(80));
  console.log('📊 COMPREHENSIVE TEST RESULTS SUMMARY');
  console.log('═'.repeat(80));
  
  console.log(`\n✅ WORKING PROXIES (${workingProxies.length}/${proxies.length}):`);
  if (workingProxies.length > 0) {
    workingProxies
      .sort((a, b) => a.responseTime - b.responseTime) // Sort by speed
      .forEach((proxy, index) => {
        console.log(`   ${index + 1}. ${proxy.proxy} - ${proxy.responseTime}ms - ${proxy.segments} segments`);
        console.log(`      Type: ${proxy.type} | Location: ${proxy.location}`);
      });
  } else {
    console.log('   No proxies are currently working');
  }
  
  console.log(`\n❌ FAILED PROXIES (${failedProxies.length}/${proxies.length}):`);
  if (failedProxies.length > 0) {
    failedProxies.forEach((proxy, index) => {
      console.log(`   ${index + 1}. ${proxy.proxy} - ${proxy.error}`);
    });
  }
  
  // Performance Analysis
  if (workingProxies.length > 0) {
    console.log(`\n⚡ PERFORMANCE ANALYSIS:`);
    const avgResponseTime = workingProxies.reduce((sum, p) => sum + p.responseTime, 0) / workingProxies.length;
    const fastestProxy = workingProxies[0]; // Already sorted by response time
    const slowestProxy = workingProxies[workingProxies.length - 1];
    
    console.log(`   Average response time: ${avgResponseTime.toFixed(0)}ms`);
    console.log(`   Fastest proxy: ${fastestProxy.proxy} (${fastestProxy.responseTime}ms)`);
    console.log(`   Slowest proxy: ${slowestProxy.proxy} (${slowestProxy.responseTime}ms)`);
  }
  
  // Recommendations
  console.log(`\n💡 RECOMMENDATIONS FOR PRODUCTION:`);
  if (workingProxies.length >= 3) {
    console.log(`   TOP 3 RECOMMENDED PROXIES:`);
    workingProxies.slice(0, 3).forEach((proxy, index) => {
      console.log(`   ${index + 1}. ${proxy.proxy} (${proxy.responseTime}ms) - ${proxy.type} proxy`);
    });
  } else if (workingProxies.length > 0) {
    console.log(`   USE THESE WORKING PROXIES:`);
    workingProxies.forEach((proxy, index) => {
      console.log(`   ${index + 1}. ${proxy.proxy} (${proxy.responseTime}ms)`);
    });
  } else {
    console.log(`   ⚠️  No proxies are currently working. Try again later or find alternative proxies.`);
  }
  
  // Proxy Rotation Configuration
  if (workingProxies.length > 1) {
    console.log(`\n🔄 PROXY ROTATION CONFIGURATION:`);
    console.log(`   const proxyPool = [`);
    workingProxies.forEach((proxy, index) => {
      const [host, port] = proxy.proxy.split(':');
      console.log(`     { host: '${host}', port: ${port}, protocol: 'https' }${index < workingProxies.length - 1 ? ',' : ''}`);
    });
    console.log(`   ];`);
  }
  
  console.log(`\n🎉 Proxy testing completed!`);
  console.log(`   Total tested: ${proxies.length}`);
  console.log(`   Working: ${workingProxies.length}`);
  console.log(`   Failed: ${failedProxies.length}`);
  console.log(`   Success rate: ${((workingProxies.length / proxies.length) * 100).toFixed(1)}%`);
}

// Run the comprehensive test
testAllProxies().catch(error => {
  console.error('❌ Test execution failed:', error.message);
}); 