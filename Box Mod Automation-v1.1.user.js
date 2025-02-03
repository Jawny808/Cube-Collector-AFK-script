// ==UserScript==
// @name         Box Mod Automation
// @namespace    http://tampermonkey.net/
// @version      v1.1
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
    let cooldownActive = false;

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

        // Look for the grey button
        const possibleButtons = [
            '.purchasemodbutton.graybutton',
            'button.purchasemodbutton',
            'div.purchasemodbutton'
        ];

        let modifierButton = null;
        for (const selector of possibleButtons) {
            const buttons = document.querySelectorAll(selector);
            modifierButton = Array.from(buttons).find(button =>
                button.querySelector('.material-symbols-outlined')?.textContent === 'flare'
            );

            if (modifierButton) {
                console.log('Found modifier button, clicking...');
                modifierButton.click();
                await new Promise(resolve => setTimeout(resolve, 500));

                // Verify the menu opened
                const menu = document.querySelector('.centerme.boxmodbuyercontainer');
                if (menu) {
                    console.log('Mod menu successfully opened');
                    return true;
                }
                break;
            }
        }

        // If we reach here, either the button wasn't found or clicking it didn't open the menu
        console.log('Modifier button not found or menu did not open - waiting for next spin');
        return false;
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
            if (!isRunning || cooldownActive) {
                if (cooldownActive) {
                    updateStatus('Waiting for cooldown...');
                }
                return false;
            }

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

            // Check if mod menu is open, if not try to open it
            const modMenu = document.querySelector('.centerme.boxmodbuyercontainer');
            if (!modMenu) {
                const menuOpened = await clickModifierArea();
                if (!menuOpened) {
                    updateStatus('Waiting for next spin opportunity...');
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return true;
                }
            }

            const buttonIdMap = {
                'Cubes Unboxed': 'boxmodincrementtwicecubesunboxed',
                'Prefix Chance': 'boxmodincrementtwiceprefixchance',
                'Stacked Prefix Chance': 'boxmodincrementtwicestackedprefixchance',
                'Divine/Slated Chance': 'boxmodincrementtwicedivineslatedchance',
                'Exotic Chance': 'boxmodincrementtwiceexoticchance'
            };

            const buttonId = buttonIdMap[selectedMod];
            console.log('Looking for increment element with ID:', buttonId);

            // Get initial value before starting the sequence
            const valueId = `boxmod${selectedMod.toLowerCase().replace(/[^a-z]/g, '')}value`;
            let currentValue = parseInt(document.getElementById(valueId)?.textContent || '0');
            console.log('Starting value:', currentValue);

            let clicksNeeded = Math.ceil((targetValue - currentValue) / 2);
            clicksNeeded = Math.max(0, clicksNeeded);

            console.log(`Selected mod: ${selectedMod}, Current: ${currentValue}, Target: ${targetValue}, Need ${clicksNeeded} clicks`);

            // Main application loop
            for (let i = 0; i < clicksNeeded && isRunning; i++) {
                try {
                    console.log(`Starting click ${i + 1} of ${clicksNeeded}`);
                    updateStatus(`Applying ${selectedMod}: Click ${i + 1}/${clicksNeeded}`);

                    // Wait for the increment button to be clickable
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    const incrementElement = document.querySelector(`div.pbmmiincrement[id="${buttonId}"]`);
                    if (!incrementElement) {
                        console.log('Could not find increment element, retrying...');
                        i--; // Retry this click
                        continue;
                    }

                    // Log element state before clicking
                    console.log('Found increment element:', incrementElement.outerHTML);

                    // Click the increment element
                    console.log('Clicking increment element...');
                    incrementElement.click();

                    // Wait longer for the confirm button to appear and stabilize
                    await new Promise(resolve => setTimeout(resolve, 1500));

                    // Look for confirm button
                    const confirmButton = document.querySelector('.purchaseboxmodsconfirm.orangebutton');
                    if (!confirmButton) {
                        console.log('Could not find confirm button, retrying...');
                        i--; // Retry this click
                        continue;
                    }

                    // Log confirm button state
                    console.log('Found confirm button:', confirmButton.outerHTML);

                    // Get value before confirming
                    const beforeValue = parseInt(document.getElementById(valueId)?.textContent || '0');

                    // Click confirm and wait for application
                    console.log('Clicking confirm button...');
                    confirmButton.click();

                    // Wait longer for the mod to be applied
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Check if value changed after confirmation
                    const afterValue = parseInt(document.getElementById(valueId)?.textContent || '0');
                    console.log(`Value change check - Before: ${beforeValue}, After: ${afterValue}`);

                    if (afterValue <= beforeValue) {
                        console.log('Value did not increase, retrying...');
                        i--; // Retry this click
                        continue;
                    }

                    // Update tracking values
                    currentValue = afterValue;
                    appliedCount++;
                    console.log(`Successfully applied mod. New value: ${afterValue}`);

                    // Update UI counter
                    const statusCounter = document.getElementById('mod-counter');
                    if (statusCounter) {
                        statusCounter.innerHTML = `Applied: ${appliedCount} times`;
                    }

                    // Check if we've reached the target
                    if (afterValue >= targetValue) {
                        console.log('Reached target value, stopping sequence');
                        break;
                    }

                    // Add a longer delay between applications
                    await new Promise(resolve => setTimeout(resolve, 2500));

                } catch (error) {
                    console.error(`Error during click ${i + 1}:`, error);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    i--; // Retry on error
                }
            }

            // After successful application sequence
            cooldownActive = true;
            updateStatus(`Successfully applied ${selectedMod} - Waiting for next spin...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            cooldownActive = false;
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

        if (targetValue < 0) {
            showNotification(`${selectedMod} value cannot be negative`);
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
        modContainer.style.resize = 'both';
        modContainer.style.overflow = 'auto';
        modContainer.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
        modContainer.style.cursor = 'move';
        modContainer.style.userSelect = 'none';
        modContainer.style.touchAction = 'none';

        // Create main container for all content
        const mainContent = document.createElement('div');
        mainContent.style.display = 'flex';
        mainContent.style.gap = '10px';

        // Create side menu
        const sideMenu = document.createElement('div');
        sideMenu.style.borderRight = '1px solid var(--accentcolor)';
        sideMenu.style.paddingRight = '10px';
        sideMenu.style.display = 'flex';
        sideMenu.style.flexDirection = 'column';
        sideMenu.style.gap = '5px';

        // Create navigation buttons
        const automationButton = createNavButton('Automation', true);
        const customizeButton = createNavButton('Customize', false);

        sideMenu.appendChild(automationButton);
        sideMenu.appendChild(customizeButton);

        // Create content containers
        const automationPanel = createAutomationPanel();
        const customizePanel = createCustomizePanel();

        // Initially hide customize panel
        customizePanel.style.display = 'none';

        // Add click handlers for navigation
        automationButton.addEventListener('click', () => {
            automationButton.classList.add('active');
            customizeButton.classList.remove('active');
            automationPanel.style.display = 'block';
            customizePanel.style.display = 'none';
        });

        customizeButton.addEventListener('click', () => {
            customizeButton.classList.add('active');
            automationButton.classList.remove('active');
            automationPanel.style.display = 'none';
            customizePanel.style.display = 'block';
        });

        // Add elements to main content
        mainContent.appendChild(sideMenu);
        mainContent.appendChild(automationPanel);
        mainContent.appendChild(customizePanel);

        // Add main content to container
        modContainer.appendChild(mainContent);
        document.body.appendChild(modContainer);

        // Add drag event listeners
        modContainer.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);
    }

    function createNavButton(text, isActive) {
        const button = document.createElement('button');
        button.textContent = text;
        button.style.padding = '8px 12px';
        button.style.background = isActive ? 'var(--accentcolor)' : 'var(--basecolor)';
        button.style.color = 'var(--textcolor)';
        button.style.border = 'none';
        button.style.borderRadius = '5px';
        button.style.cursor = 'pointer';
        button.style.width = '100%';
        button.style.marginBottom = '5px';
        if (isActive) button.classList.add('active');
        return button;
    }

    function createAutomationPanel() {
        const panel = document.createElement('div');
        panel.id = 'automation-panel';
        panel.style.flex = '1';
        panel.style.padding = '10px';

        // Add title
        const title = document.createElement('div');
        title.textContent = 'Box Mod Automation';
        title.style.color = 'var(--accentcolor)';
        title.style.fontSize = '1.2em';
        title.style.marginBottom = '15px';
        panel.appendChild(title);

        const flexContainer = document.createElement('div');
        flexContainer.style.display = 'flex';
        flexContainer.style.flexDirection = 'column';
        flexContainer.style.gap = '5px';

        // Title
        const desiredValueTitle = document.createElement('div');
        desiredValueTitle.textContent = 'Desired Value:';
        desiredValueTitle.style.color = 'var(--accentcolor)';
        desiredValueTitle.style.marginBottom = '5px';

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
        flexContainer.appendChild(desiredValueTitle);
        flexContainer.appendChild(modSelect);
        flexContainer.appendChild(maxValueLabel);
        flexContainer.appendChild(valueInput);
        flexContainer.appendChild(toggleButton);
        flexContainer.appendChild(statusCounter);
        flexContainer.appendChild(statusMessage);

        // Add toggle button event listener
        toggleButton.addEventListener('click', () => {
            if (isRunning) {
                stopModding();
            } else {
                startModding();
            }
        });

        panel.appendChild(flexContainer);
        return panel;
    }

    function createCustomizePanel() {
        const panel = document.createElement('div');
        panel.id = 'customize-panel';
        panel.style.flex = '1';
        panel.style.padding = '10px';

        // Add title
        const title = document.createElement('div');
        title.textContent = 'Customize Interface';
        title.style.color = 'var(--accentcolor)';
        title.style.fontSize = '1.2em';
        title.style.marginBottom = '15px';
        panel.appendChild(title);

        // Create color pickers
        const colors = [
            { label: 'Main Color', id: 'main-color', variable: '--basecolor' },
            { label: 'Accent Color', id: 'accent-color', variable: '--accentcolor' },
            { label: 'Text Color', id: 'text-color', variable: '--textcolor' }
        ];

        colors.forEach(color => {
            const container = document.createElement('div');
            container.style.marginBottom = '15px';
            container.style.display = 'flex';
            container.style.alignItems = 'center';
            container.style.gap = '10px';

            const labelContainer = document.createElement('div');
            labelContainer.style.flex = '1';

            const label = document.createElement('label');
            label.textContent = color.label;
            label.style.color = 'var(--textcolor)';
            label.style.display = 'block';
            label.style.marginBottom = '5px';
            label.style.fontSize = '0.9em'; // Slightly smaller than title

            const currentColor = getComputedStyle(document.documentElement)
                .getPropertyValue(color.variable)
                .trim();

            // Create hex input
            const hexInput = document.createElement('input');
            hexInput.type = 'text';
            hexInput.value = currentColor;
            hexInput.id = `${color.id}-hex`;
            hexInput.style.width = '100px';
            hexInput.style.padding = '5px';
            hexInput.style.border = '2px solid var(--accentcolor)'; // Make border more visible
            hexInput.style.borderRadius = '5px';
            hexInput.style.background = 'var(--basecolor)';
            hexInput.style.color = 'var(--textcolor)';
            hexInput.style.fontSize = '0.8em'; // Slightly smaller font for hex codes
            hexInput.placeholder = '#RRGGBB';

            // Create color preview
            const preview = document.createElement('div');
            preview.style.width = '40px';  // Increased size
            preview.style.height = '40px';  // Increased size
            preview.style.borderRadius = '5px';
            preview.style.border = '2px solid var(--accentcolor)'; // Match input border
            preview.style.background = currentColor;
            preview.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)'; // Add subtle shadow
            preview.style.transition = 'all 0.2s ease'; // Smooth transitions

            // Update color when hex input changes
            hexInput.addEventListener('input', (e) => {
                let value = e.target.value;

                // Remove any spaces
                value = value.replace(/\s/g, '');

                // Add # if missing
                if (value && !value.startsWith('#')) {
                    value = '#' + value;
                }

                // Convert to uppercase
                value = value.toUpperCase();

                // Update input value
                if (value !== e.target.value) {
                    e.target.value = value;
                }

                // Validate hex color
                if (/^#[0-9A-F]{6}$/.test(value)) {
                    document.documentElement.style.setProperty(color.variable, value);
                    preview.style.background = value;
                    hexInput.style.border = '2px solid var(--accentcolor)';
                    // Store the color in localStorage
                    localStorage.setItem(`boxmod_${color.id}`, value);
                } else {
                    hexInput.style.border = '2px solid #ff4444';
                }
            });

            // Load saved color on startup
            const savedColor = localStorage.getItem(`boxmod_${color.id}`);
            if (savedColor) {
                hexInput.value = savedColor;
                document.documentElement.style.setProperty(color.variable, savedColor);
                preview.style.background = savedColor;
            }

            labelContainer.appendChild(label);
            labelContainer.appendChild(hexInput);
            container.appendChild(labelContainer);
            container.appendChild(preview);
            panel.appendChild(container);
        });

        // Add opacity slider
        const opacityContainer = document.createElement('div');
        opacityContainer.style.marginBottom = '15px';

        const opacityLabel = document.createElement('label');
        opacityLabel.textContent = 'Interface Opacity';
        opacityLabel.style.color = 'var(--textcolor)';
        opacityLabel.style.display = 'block';
        opacityLabel.style.marginBottom = '5px';
        opacityLabel.style.fontSize = '0.9em'; // Match other labels

        const opacitySlider = document.createElement('input');
        opacitySlider.type = 'range';
        opacitySlider.min = '0';
        opacitySlider.max = '1';
        opacitySlider.step = '0.1';
        opacitySlider.value = localStorage.getItem('boxmod_interface_opacity') || '1';
        opacitySlider.id = 'interface-opacity';
        opacitySlider.style.width = '100%';
        opacitySlider.style.margin = '10px 0';
        opacitySlider.style.accentColor = 'var(--accentcolor)';

        const opacityValue = document.createElement('span');
        opacityValue.textContent = (localStorage.getItem('boxmod_interface_opacity') || '1.0');
        opacityValue.style.color = 'var(--textcolor)';
        opacityValue.style.marginLeft = '10px';
        opacityValue.style.fontSize = '0.9em';

        opacitySlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value).toFixed(1);
            opacityValue.textContent = value;
            modContainer.style.opacity = value;
            localStorage.setItem('boxmod_interface_opacity', value);
        });

        // Set initial opacity
        modContainer.style.opacity = opacitySlider.value;

        opacityContainer.appendChild(opacityLabel);
        opacityContainer.appendChild(opacitySlider);
        opacityContainer.appendChild(opacityValue);
        panel.appendChild(opacityContainer);

        return panel;
    }

    function startModding() {
        if (!isRunning) {
            const modSelect = document.getElementById('mod-select');
            const valueInput = document.getElementById('value-input');

            if (!modSelect || !valueInput) {
                showNotification('Error: Interface elements not found');
                return;
            }

            if (modSelect.value === 'Select Modifier') {
                showNotification('Please select a modifier first!');
                return;
            }

            const targetValue = parseInt(valueInput.value);
            if (!validateTargetValue(modSelect.value, targetValue)) {
                return;
            }

            isRunning = true;
            cooldownActive = false;
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
                    console.log('Waiting for next opportunity...');
                }
            }, 1000); // 1 second interval
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