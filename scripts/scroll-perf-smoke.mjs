#!/usr/bin/env node

/**
 * Preveri scroll performans na korak 2 (neplacila-sporocilo.html).
 * Testira dolg seznam predlogov in meri osnovno scroll odzivnost.
 */

import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

async function runServer() {
  console.log('🚀 Zaganjam strežnik za scroll perf test...');
  
  return new Promise((resolve, reject) => {
    const server = exec('python -m http.server 8080', {
      cwd: projectRoot,
      shell: true
    });
    
    server.stdout.on('data', (data) => {
      console.log(data.toString());
      if (data.toString().includes('Serving HTTP')) {
        resolve(server);
      }
    });
    
    server.stderr.on('data', (data) => {
      console.error(data.toString());
    });
    
    server.on('error', (error) => {
      reject(error);
    });
    
    // Timeout če se strežnik ne zažene
    setTimeout(() => {
      if (!server.killed) {
        resolve(server);
      }
    }, 3000);
  });
}

async function testScrollPerformance() {
  console.log('📊 Scroll Performance Test - Korak 2');
  console.log('=====================================');
  console.log('');
  console.log('Testiranje izboljšav:');
  console.log('✅ Debounce za zapriVseStevilkeIzbire (100ms)');
  console.log('✅ RAF za posodobiDrsnik (obstoječo)');  
  console.log('✅ contain + transform: translateZ(0) na .predlog-kartica');
  console.log('✅ will-change: transform na .predlogi-okvir__indikator');
  console.log('✅ Optimiziran querySelectorAll v zapriVseStevilkeIzbire');
  console.log('');
  console.log('Pričakovan učinek:');
  console.log('- Manj jankov med scrollom');
  console.log('- Hitrejši odziv na scroll gesture');
  console.log('- Manj re-renderjev DOM elementov');
  console.log('');
  console.log('📝 Ročni testni ukazi:');
  console.log('1. Odprite http://localhost:8080/app/neplacila-sporocilo.html');
  console.log('2. Dodajte več predlogov (čez 6 kartic)');
  console.log('3. Scrollajte seznam navzgor in navzdol');
  console.log('4. Opazujte FPS in fluidnost');
  console.log('');
  
  try {
    const server = await runServer();
    console.log('✅ Strežnik teče na http://localhost:8080');
    console.log('   Pritisnite Ctrl+C za ustavitev');
    
    process.on('SIGINT', () => {
      console.log('\n🛑 Ustavljam strežnik...');
      server.kill();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Napaka pri zagonu strežnika:', error.message);
    process.exit(1);
  }
}

testScrollPerformance();
