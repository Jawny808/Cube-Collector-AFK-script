// ==UserScript==
// @name         Box Mod Automation
// @namespace    http://tampermonkey.net/
// @version      v1.0
// @description  Automated box mod application for Cube Collector
// @author       vvaxx
// @match        https://cubecollector.net/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=cubecollector.net
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    console.log('Box Mod Automation Script v1.0 - Starting...');

    let modInterval;
    let isRunning = false;
    let appliedCount = 0;
    let modContainer = null;
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    // Max values for each modifier
    const MAX_VALUES = {
        'Cubes Unboxed': 9,
        'Prefix Chance': 100,
        'Stacked Prefix Chance': 40,
        'Divine/Slated Chance': 5,
        'Exotic Chance': 75
    };

    function showNotification(message, duration = 3000) {
        const notification = document.createElement('div');
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.left = '50%';
        notification.style.transform = 'translateX(-50%)';
        notification.style.background = 'rgba(0, 0, 0, 0.9)';
        notification.style.color = 'var(--accentcolor)';
        notification.style.padding = '12px 24px';
        notification.style.borderRadius = '8px';
        notification.style.zIndex = '10000';
        notification.style.border = '2px solid var(--accentcolor)';
        notification.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
        notification.style.fontSize = '14px';
        notification.style.fontWeight = 'bold';
        notification.textContent = message;

        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), duration);
    }

    function updateStatus(message) {
        const statusMessage = document.getElementById('mod-status');
        if (statusMessage) {
            statusMessage.innerHTML = message;
            console.log('Status:', message);
        }
    }

    async function clickModifierArea() {
        // Look for the centerme container first
        const modifierContainer = document.querySelector('.centerme.boxmodbuyercontainer');
        if (modifierContainer) {
            console.log('Mod menu already open');
            return true;
        }

        // Try multiple possible button selectors
        const possibleButtons = [
            '.purchasemodbutton.graybutton',
            'button.purchasemodbutton',
            'div.purchasemodbutton'
        ];

        let modifierButton = null;
        for (const selector of possibleButtons) {
            const buttons = document.querySelectorAll(selector);
            console.log(`Searching for button with selector: ${selector}, found: ${buttons.length} buttons`);

            modifierButton = Array.from(buttons).find(button =>
                button.querySelector('.material-symbols-outlined')?.textContent === 'flare'
            );

            if (modifierButton) {
                console.log('Found modifier button with selector:', selector);
                break;
            }
        }

        if (!modifierButton) {
            console.error('Could not find any modifier button with known selectors');
            showNotification('Error: Could not find modifier button. Please ensure you are in the correct menu.');
            return false;
        }

        console.log('Clicking modifier button...');
        modifierButton.click();
        await new Promise(resolve => setTimeout(resolve, 500)); // Increased wait time

        // Verify the menu opened
        const menu = document.querySelector('.centerme.boxmodbuyercontainer');
        if (!menu) {
            console.error('Modifier menu did not appear after clicking button');
            showNotification('Error: Modifier menu did not appear');
            return false;
        }

        console.log('Mod menu successfully opened');
        return true;
    }

    function dragStart(e) {
        if (e.type === "mousedown") {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;

            if (e.target === modContainer || e.target.parentNode === modContainer) {
                isDragging = true;
            }
        }
    }

    function drag(e) {
        if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;

            xOffset = currentX;
            yOffset = currentY;

            setTranslate(currentX, currentY, modContainer);
        }
    }

    function dragEnd(e) {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
    }

    function setTranslate(xPos, yPos, el) {
        el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
    }

    async function applyMod() {
        try {
            if (!isRunning) return false;

            const modSelect = document.getElementById('mod-select');
            const valueInput = document.getElementById('value-input');
            if (!modSelect || !valueInput) {
                showNotification('Error: Interface elements not found');
                return false;
            }

            const selectedMod = modSelect.value;
            const targetValue = parseInt(valueInput.value);

            if (selectedMod === 'Select Modifier') {
                showNotification('Please select a modifier first!');
                stopModding();
                return false;
            }

            if (!validateTargetValue(selectedMod, targetValue)) {
                stopModding();
                return false;
            }

            // Open modifier menu if needed
            if (!document.querySelector('.centerme.boxmodbuyercontainer')) {
                console.log('Attempting to open modifier menu...');
                if (!await clickModifierArea()) {
                    console.error('Failed to open modifier menu');
                    return false;
                }
            }

            // Debugging: Log the exact button we're looking for
            const buttonId = selectedMod === 'Cubes Unboxed'
                ? `boxmodincrementtwice${selectedMod.toLowerCase().replace(/[^a-z]/g, '')}`
                : `boxmodincrementtwice${selectedMod.toLowerCase().replace(/[^a-z]/g, '')}chance`;

            console.log('Looking for ++ button with ID:', buttonId);
            console.log('Selected Modifier:', selectedMod);

            const doubleButton = document.getElementById(buttonId);

            if (!doubleButton) {
                console.error('Could not find ++ button with ID:', buttonId);
                console.log('Available ++ buttons:', document.querySelectorAll('.pbmmiincrement').length);
                showNotification('Error: Could not find modifier button');
                return false;
            }

            console.log('Found ++ button:', doubleButton);

            // Calculate clicks needed (each ++ adds 2)
            const clicksNeeded = Math.ceil(targetValue / 2);
            console.log(`Need ${clicksNeeded} clicks to reach target value of ${targetValue}`);

            for (let i = 0; i < clicksNeeded && isRunning; i++) {
                doubleButton.click();
                await new Promise(resolve => setTimeout(resolve, 200));

                const confirmButton = document.querySelector('.purchaseboxmodsconfirm.orangebutton');
                if (!confirmButton) {
                    console.error('Could not find confirm button with class .purchaseboxmodsconfirm.orangebutton');
                    console.log('Available buttons:', document.querySelectorAll('button').length);
                    showNotification('Error: Could not find confirm button');
                    return false;
                }

                console.log('Found confirm button, clicking...');
                confirmButton.click();
                appliedCount++;

                const statusCounter = document.getElementById('mod-counter');
                if (statusCounter) {
                    statusCounter.innerHTML = `Applied: ${appliedCount} times`;
                }

                await new Promise(resolve => setTimeout(resolve, 200));
            }

            updateStatus(`Successfully applied ${selectedMod}`);
            return true;

        } catch (error) {
            console.error('Error in applyMod:', error);
            showNotification('Error: Failed to apply modifier');
            return false;
        }
    }

    function validateTargetValue(selectedMod, targetValue) {
        const maxValue = MAX_VALUES[selectedMod];
        if (targetValue > maxValue) {
            showNotification(`${selectedMod} cannot exceed ${maxValue}`);
            return false;
        }
        return true;
    }

    function createInterface() {
        if (modContainer) return;

        modContainer = document.createElement('div');
        modContainer.id = 'mod-automation-container';
        modContainer.style.position = 'fixed';
        modContainer.style.bottom = '20px';
        modContainer.style.right = '20px';
        modContainer.style.zIndex = '9999';
        modContainer.style.padding = '15px';
        modContainer.style.background = 'url(/JackpotBGS/Black.png)';
        modContainer.style.borderRadius = '10px';
        modContainer.style.border = '2px solid var(--accentcolor)';
        modContainer.style.minWidth = '200px';
        modContainer.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
        modContainer.style.cursor = 'move'; // Add cursor style for dragging
        modContainer.style.userSelect = 'none'; // Prevent text selection while dragging
        modContainer.style.touchAction = 'none'; // Prevent scrolling on touch devices

        // Add drag event listeners
        modContainer.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);


        const flexContainer = document.createElement('div');
        flexContainer.style.display = 'flex';
        flexContainer.style.flexDirection = 'column';
        flexContainer.style.gap = '5px';

        // Title
        const title = document.createElement('div');
        title.textContent = 'Desired Value:';
        title.style.color = 'var(--accentcolor)';
        title.style.marginBottom = '5px';

        // Mod selection dropdown
        const modSelect = document.createElement('select');
        modSelect.id = 'mod-select';
        modSelect.style.marginBottom = '10px';
        modSelect.style.fontSize = '1em';
        modSelect.style.color = 'var(--accentcolor)';
        modSelect.style.background = 'var(--basecolor)';
        modSelect.style.borderRadius = '5px';
        modSelect.style.padding = '5px';
        modSelect.style.width = '150px';

        const modOptions = [
            'Select Modifier',
            'Cubes Unboxed',
            'Prefix Chance',
            'Stacked Prefix Chance',
            'Divine/Slated Chance',
            'Exotic Chance'
        ];

        modOptions.forEach(mod => {
            const option = document.createElement('option');
            option.value = mod;
            option.text = mod;
            modSelect.appendChild(option);
        });

        // Max value label
        const maxValueLabel = document.createElement('div');
        maxValueLabel.style.fontSize = '0.8em';
        maxValueLabel.style.color = '#888';
        maxValueLabel.style.marginBottom = '10px';

        modSelect.addEventListener('change', () => {
            const selectedMod = modSelect.value;
            if (selectedMod in MAX_VALUES) {
                maxValueLabel.textContent = `Maximum value: ${MAX_VALUES[selectedMod]}`;
            } else {
                maxValueLabel.textContent = '';
            }
        });

        // Value input
        const valueInput = document.createElement('input');
        valueInput.id = 'value-input';
        valueInput.type = 'number';
        valueInput.min = '1';
        valueInput.value = '1';
        valueInput.style.width = '150px';
        valueInput.style.marginBottom = '10px';
        valueInput.style.fontSize = '1em';
        valueInput.style.color = 'var(--accentcolor)';
        valueInput.style.background = 'var(--basecolor)';
        valueInput.style.borderRadius = '5px';
        valueInput.style.padding = '5px';

        // Toggle button
        const toggleButton = document.createElement('button');
        toggleButton.id = 'mod-toggle';
        toggleButton.innerHTML = 'Start Automation';
        toggleButton.style.borderRadius = '10px';
        toggleButton.style.fontSize = '1em';
        toggleButton.style.color = 'var(--accentcolor)';
        toggleButton.style.background = 'var(--basecolor)';
        toggleButton.style.padding = '5px 15px';
        toggleButton.style.cursor = 'pointer';
        toggleButton.style.width = '150px';

        // Status elements
        const statusCounter = document.createElement('span');
        statusCounter.id = 'mod-counter';
        statusCounter.style.fontSize = '1em';
        statusCounter.style.color = 'var(--accentcolor)';
        statusCounter.innerHTML = 'Ready to start';

        const statusMessage = document.createElement('span');
        statusMessage.id = 'mod-status';
        statusMessage.style.fontSize = '0.9em';
        statusMessage.style.color = '#888';
        statusMessage.style.display = 'block';
        statusMessage.style.marginTop = '5px';

        // Add elements to container
        flexContainer.appendChild(title);
        flexContainer.appendChild(modSelect);
        flexContainer.appendChild(maxValueLabel);
        flexContainer.appendChild(valueInput);
        flexContainer.appendChild(toggleButton);
        flexContainer.appendChild(statusCounter);
        flexContainer.appendChild(statusMessage);

        modContainer.appendChild(flexContainer);
        document.body.appendChild(modContainer);

        // Add button event listener
        toggleButton.addEventListener('click', () => {
            if (isRunning) {
                stopModding();
            } else {
                startModding();
            }
        });
    }

    function startModding() {
        if (!isRunning) {
            isRunning = true;
            appliedCount = 0;
            const toggleButton = document.getElementById('mod-toggle');
            if (toggleButton) {
                toggleButton.innerHTML = 'Stop Automation';
                toggleButton.style.background = '#ff4444';
            }
            showNotification('Modifier automation started - Press ESC to stop');
            const statusCounter = document.getElementById('mod-counter');
            if (statusCounter) {
                statusCounter.innerHTML = 'Starting automation...';
            }

            modInterval = setInterval(async () => {
                if (isRunning && !await applyMod()) {
                    console.log('Failed to apply mod, retrying...');
                }
            }, 500);
        }
    }

    function stopModding() {
        if (isRunning) {
            isRunning = false;
            clearInterval(modInterval);
            const toggleButton = document.getElementById('mod-toggle');
            if (toggleButton) {
                toggleButton.innerHTML = 'Start Automation';
                toggleButton.style.background = 'var(--basecolor)';
            }
            showNotification('Modifier automation stopped');
            updateStatus('Automation stopped');
        }
    }

    // Monitor for AFK button
    const observer = new MutationObserver((mutations) => {
        for (let mutation of mutations) {
            if (mutation.addedNodes.length) {
                const buttons = document.querySelectorAll('button');
                const afkButton = Array.from(buttons).find(button =>
                    button.textContent.includes('Stop AFKing')
                );

                if (afkButton) {
                    createInterface();
                    modContainer.style.display = 'block';
                    showNotification('Box Mod Automation interface shown - Alt + M to hide');
                    observer.disconnect();
                }
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Toggle interface with Alt + M
    window.addEventListener('keydown', (evt) => {
        if (evt.altKey && evt.key === 'm') {
            if (!modContainer) {
                createInterface();
            }
            modContainer.style.display = modContainer.style.display === 'none' ? 'block' : 'none';
            if (modContainer.style.display === 'block') {
                showNotification('Box Mod Automation interface shown (Alt + M to hide)');
            }
        }

        // Emergency stop with ESC
        if (evt.key === 'Escape' || evt.key === 'Esc') {
            if (isRunning) {
                stopModding();
            }
        }
    });

    // Initialize script
    console.log('Box Mod Automation v1.0 ready - Press Alt + M to show interface');
    showNotification('Box mod script by vvaxx loaded - interface will appear with alt+m', 7000);
})();