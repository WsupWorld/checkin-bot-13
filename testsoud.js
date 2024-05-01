


const { exec } = require('child_process');


function playBeep(frequency, duration, beeps) {
    for (let i = 0; i < beeps; i++) {
      exec(`powershell.exe [console]::beep(${frequency},${duration})`);
    }
}

playBeep(100, 3)