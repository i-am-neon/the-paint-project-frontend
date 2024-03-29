// @TODO:
// - Persist custom colors list across reloads? It's not very persistent in real Windows...
// - OK with Enter, after selecting a focused color if applicable
// - maybe use https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/Grid_Role
// - Question mark button in titlebar that lets you click on parts of UI to ask about them; also context menu "What's this?"
// - For mobile layout, maybe add a way to get back (<<) without adding (potentially overwriting) a custom color
// - Speech recognition
//   - Lum as Luminosity, Luminance, Lightness, maybe even Brightness
//   - Sat as Saturation
//   - Add / Add Color / Add Custom Color for Add To Custom Colors or if not available then Define Custom Colors >>
//   - Set green to 50 etc.

// In Windows, the Hue goes from 0 to 239 (240 being equivalent to 0), and Sat and Lum go from 0 to 240
// I think people are more familiar with degrees and percentages, so I don't think I'll be implementing that.

// Development workflow:
// - In the console, set localStorage.dev_edit_colors = "true";
// - Reload the page
// - Load a screenshot of the Edit Colors window into the editor
// - Position it finely using the arrow keys on a selection
// - For measuring positions, look at the Windows source code OR:
//   - close the window,
//   - point on the canvas, mark down the coordinates shown in status bar,
//   - point on the canvas at the origin
//     - the top left of the inside of the window, or
//     - the top left of (what corresponds to) the nearest parent position:fixed/absolute/relative
//   - subtract the origin from the target

	// CREATING COLOR FORM ELEMENTS
	const walletErrorMsg = document.createElement("p");
	walletErrorMsg.innerText = "Please connect your wallet."
	$(walletErrorMsg).css({
		color: "red",
		marginLeft: 45,
	});

	const genericErrorMsg = document.createElement("p");
	genericErrorMsg.innerText = "Error. Maybe someone has just minted this color?"
	$(genericErrorMsg).css({
		color: "red",
		marginLeft: 5,
	});

	const colorNotAvailContainer = document.createElement("div");
	const colorNotAvailMsg1 = document.createElement("p");
	colorNotAvailMsg1.innerText = "This color is not available."
	$(colorNotAvailMsg1).css({
		color: "red",
		marginLeft: 47
	});
	const colorNotAvailMsg2 = document.createElement("p");
	colorNotAvailMsg2.innerText = "Try a different one!"
	$(colorNotAvailMsg2).css({
		color: "red",
		marginLeft: 60
	});
	$(colorNotAvailContainer).append(colorNotAvailMsg1, colorNotAvailMsg2)

	const allPaintsMintedContainer = document.createElement("div");
	const allPaintsMintedMsg1 = document.createElement("p");
	allPaintsMintedMsg1.innerText = "All 1024 Paints have been minted!"
	$(allPaintsMintedMsg1).css({
		color: "red",
		marginLeft: 32
	});
	const allPaintsMintedMsg2 = document.createElement("p");
	allPaintsMintedMsg2.innerText = "See them in the \"Colors\" menu."
	$(allPaintsMintedMsg2).css({
		color: "red",
		marginLeft: 36
	});
	$(allPaintsMintedContainer).append(allPaintsMintedMsg1, allPaintsMintedMsg2)

	let mintWaitingMsg = document.createElement("p");
	mintWaitingMsg.innerText = "Minting, just sit tight...";
	$(mintWaitingMsg).addClass('rainbow-mint-loading rainbow_text_animated');

	let mintSuccessMsg = document.createElement("p");
	mintSuccessMsg.innerText = "Mint successful. Congratulations!";
	$(mintSuccessMsg).css({
		color: "green",
		marginLeft: 30,
		marginTop: 5,
	});

	let viewPaintMsg = document.createElement("p");
	viewPaintMsg.innerText = "View your new Paint in Wallet > My Paints";
	$(viewPaintMsg).css({
		color: "green",
		marginTop: -8
	});

	let mintButton = document.createElement("button");
	mintButton.innerText = "Mint";
	$(mintButton).css({
		width: 50,
		marginLeft: 87,
	})

	let availableMgs1 = document.createElement("p");
	availableMgs1.innerText = "This color is available.";
	$(availableMgs1).css({
		color: "green",
		marginLeft: 57,
		marginTop: 5,
});

	let availableMgs2 = document.createElement("p");
	availableMgs2.innerText = "Are you ready to make history?";
	$(availableMgs2).css({
		color: "green",
		marginLeft: 37,
});

	let loadingElispes = document.createElement("p");
	loadingElispes.innerText = "Querying the blockchain";
	$(loadingElispes).addClass('rainbow-check-avail-loading rainbow_text_animated');



let $edit_colors_window;

let dev_edit_colors = false;
try {
	dev_edit_colors = localStorage.dev_edit_colors === "true";
	// eslint-disable-next-line no-empty
} catch (error) { }
if (dev_edit_colors) {
	$(()=> {
		show_edit_colors_window();
		$(".define-custom-colors-button").click();
		$edit_colors_window.css({
			left: 80,
			top: 50,
			opacity: 0.5,
		});
	});
}

// Paint-specific handling of color picking
// Note: It always updates a cell in the palette and one of the color selections.
// When the dialog is opened, it always starts* with one of the color selections,
// which lets you use the color picker and then add a custom color based on that.
// *It may not show the color in the grid, but it will in the custom colors area.
function show_edit_colors_window($swatch_to_edit, color_selection_slot_to_edit) {
	// console.log($swatch_to_edit, $colorbox.data("$last_fg_color_button"));
	$swatch_to_edit = $swatch_to_edit || $colorbox.data("$last_fg_color_button");
	color_selection_slot_to_edit = color_selection_slot_to_edit || "foreground";

	const $palette = $swatch_to_edit.closest(".palette, .color-box");
	const swatch_index = $palette.find(".swatch").toArray().indexOf($swatch_to_edit[0]);
	const initial_color = colors[color_selection_slot_to_edit];
	choose_color(initial_color, (color)=> {
		// The palette may have changed or rerendered due to switching themes,
		// toggling vertical color box mode, or monochrome document mode.
		$swatch_to_edit = $($palette.find(".swatch")[swatch_index]);
		if (!$swatch_to_edit.length) {
			show_error_message("Swatch no longer exists.");
			return;
		}

		palette[swatch_index] = color;
		update_$swatch($swatch_to_edit, color);
		colors[color_selection_slot_to_edit] = color;
		$G.triggerHandler("option-changed");
		window.console && console.log(`Updated palette: ${palette.map(()=> `%c█`).join("")}`, ...palette.map((color)=> `color: ${color};`));
	});
}

// Repurposable color picker modeled after the Windows system color picker
function choose_color(initial_color, callback) {
	if ($edit_colors_window) {
		$edit_colors_window.close();
	}
	const $w = new $FormToolWindow(localize("Mint a Paint"));
	$w.addClass("edit-colors-window");
	$edit_colors_window = $w;

	let hue_degrees = 0;
	let sat_percent = 50;
	let lum_percent = 50;

	let custom_colors_index = 0;

	const get_current_color = ()=> `hsl(${hue_degrees}deg, ${sat_percent}%, ${lum_percent}%)`;
	const set_color_from_rgb = (r, g, b)=> {
		const [h, s, l] = rgb_to_hsl(r, g, b);
		hue_degrees = h * 360;
		sat_percent = s * 100;
		lum_percent = l * 100;
	};

	// Begin hex functions

	const is_hex_value = (val) => {
		const result = /^#[0-9A-F]{6}$/i.test(val)
		return result
	}

	const rgb_to_hex = (r, g, b) => {
		r = r.toString(16).toUpperCase();
		g = g.toString(16).toUpperCase();
		b = b.toString(16).toUpperCase();

		if (r == "255")
			r = "FF";
		if (g == "255")
			g = "FF";
		if (b == "255")
			b = "FF";
	  
		if (r.length == 1)
		  r = "0" + r;
		if (g.length == 1)
		  g = "0" + g;
		if (b.length == 1)
		  b = "0" + b;

		return "#" + r + g + b;
	  }

	  const hex_to_rgb =(h) => {
		let r = 0, g = 0, b = 0;
	  
		// 3 digits
		if (h.length == 4) {
		  r = "0x" + h[1] + h[1];
		  g = "0x" + h[2] + h[2];
		  b = "0x" + h[3] + h[3];
	  
		// 6 digits
		} else if (h.length == 7) {
		  r = "0x" + h[1] + h[2];
		  g = "0x" + h[3] + h[4];
		  b = "0x" + h[5] + h[6];
		}
		
		return {r, g, b};
	  }

	// End hex functions

	const set_color = (color)=> {
		const [r, g, b] = get_rgba_from_color(color);
		set_color_from_rgb(r, g, b);
	};
	const select = ($swatch)=> {
		$w.$content.find(".swatch").removeClass("selected");
		$swatch.addClass("selected");
		set_color($swatch[0].dataset.color);
		if ($swatch.closest("#custom-colors")) {
			custom_colors_index = Math.max(0, custom_colors_swatches_list_order.indexOf(
				$custom_colors_grid.find(".swatch.selected")[0]
			));
		}
		update_inputs("hslrgb");
	};

	// const make_color_grid = (colors, id)=> {
	// 	const $color_grid = $(`<div class="color-grid" tabindex="0">`).attr({id});
	// 	for (const color of colors) {
	// 		const $swatch = $Swatch(color);
	// 		$swatch.appendTo($color_grid).addClass("inset-deep");
	// 		$swatch.attr("tabindex", -1); // can be focused by clicking or calling focus() but not by tabbing
	// 	}
	// 	let $local_last_focus = $color_grid.find(".swatch:first-child");
	// 	const num_colors_per_row = 8;
	// 	const navigate = (relative_index)=> {
	// 		const $focused = $color_grid.find(".swatch:focus");
	// 		if (!$focused.length) { return; }
	// 		const $swatches = $color_grid.find(".swatch");
	// 		const from_index = $swatches.toArray().indexOf($focused[0]);
	// 		if (relative_index === -1 && (from_index % num_colors_per_row) === 0) { return; }
	// 		if (relative_index === +1 && (from_index % num_colors_per_row) === num_colors_per_row - 1) { return; }
	// 		const to_index = from_index + relative_index;
	// 		const $to_focus = $($swatches.toArray()[to_index]);
	// 		// console.log({from_index, to_index, $focused, $to_focus});
	// 		if (!$to_focus.length) { return; }
	// 		$to_focus.focus();
	// 	};
	// 	$color_grid.on("keydown", (event)=> {
	// 		// console.log(event.code);
	// 		if (event.code === "ArrowRight") { navigate(+1); }
	// 		if (event.code === "ArrowLeft") { navigate(-1); }
	// 		if (event.code === "ArrowDown") { navigate(+num_colors_per_row); }
	// 		if (event.code === "ArrowUp") { navigate(-num_colors_per_row); }
	// 		if (event.code === "Home") { $color_grid.find(".swatch:first-child").focus(); }
	// 		if (event.code === "End") { $color_grid.find(".swatch:last-child").focus(); }
	// 		if (event.code === "Space" || event.code === "Enter") {
	// 			select($color_grid.find(".swatch:focus"));
	// 			draw();
	// 		}
	// 	});
	// 	$color_grid.on("pointerdown", (event)=> {
	// 		const $swatch = $(event.target).closest(".swatch");
	// 		if ($swatch.length) {
	// 			select($swatch);
	// 			draw();
	// 		}
	// 	});
	// 	$color_grid.on("dragstart", (event)=> {
	// 		event.preventDefault();
	// 	});
	// 	$color_grid.on("focusin", (event)=> {
	// 		if (event.target.closest(".swatch")) {
	// 			$local_last_focus = $(event.target.closest(".swatch"));
	// 		} else {
	// 			if (!$local_last_focus.is(":focus")) { // prevent infinite recursion
	// 				$local_last_focus.focus();
	// 			}
	// 		}
	// 		// allow shift+tabbing out of the control
	// 		// otherwise it keeps setting focus back to the color cell,
	// 		// since the parent grid is previous in the tab order
	// 		$color_grid.attr("tabindex", -1);
	// 	});
	// 	$color_grid.on("focusout", (event)=> {
	// 		$color_grid.attr("tabindex", 0);
	// 	});
	// 	return $color_grid;
	// };
	const $left_right_split = $(`<div class="left-right-split">`).appendTo($w.$main);
	const $left = $(`<div class="left-side">`).appendTo($left_right_split);
	const $right = $(`<div class="right-side">`).appendTo($left_right_split).hide();
	$left.append(`<p>Use the color picker <strong>and slider</strong> to choose</p>`);
	$left.append(`<p style="margin-top: -12px;">${display_hotkey("the &Paint you want to mint.")}</p>`);
	$left.append(`<p style="margin-top: 15px;">${display_hotkey("You can also paste your hex value below:")}</p>`);
	// const $basic_colors_grid = make_color_grid(basic_colors, "basic-colors").appendTo($left);
	// $left.append(`<label for="custom-colors">${display_hotkey("&Custom colors:")}</label>`);
	// const custom_colors_dom_order = []; // (wanting) horizontal top to bottom
	// for (let list_index = 0; list_index < custom_colors.length; list_index++) {
	// 	const row = list_index % 2;
	// 	const column = Math.floor(list_index / 2);
	// 	const dom_index = row * 8 + column;
	// 	custom_colors_dom_order[dom_index] = custom_colors[list_index];
	// }
	// const $custom_colors_grid = make_color_grid(custom_colors_dom_order, "custom-colors").appendTo($left);
	// const custom_colors_swatches_dom_order = $custom_colors_grid.find(".swatch").toArray(); // horizontal top to bottom
	// const custom_colors_swatches_list_order = []; // (wanting) vertical left to right
	// for (let dom_index = 0; dom_index < custom_colors_swatches_dom_order.length; dom_index++) {
	// 	const row = Math.floor(dom_index / 8);
	// 	const column = dom_index % 8;
	// 	const list_index = column * 2 + row;
	// 	custom_colors_swatches_list_order[list_index] = custom_colors_swatches_dom_order[dom_index];
	// 	// custom_colors_swatches_list_order[list_index].textContent = list_index; // visualization
	// }
	$right.show();
	$w.addClass("defining-custom-colors"); // for mobile layout

	// const $define_custom_colors_button = $(`<button class="define-custom-colors-button">`)
	// .html(display_hotkey("&Define Custom Colors >>"))
	// .appendTo($left)
	// .on("click", (e)=> {
	// 	// prevent the form from submitting
	// 	// @TODO: instead, prevent the form's submit event in $Window.js in os-gui (or don't have a form? idk)
	// 	e.preventDefault();

	// 	$define_custom_colors_button.attr("disabled", "disabled");
	// 	// assuming small viewport implies mobile implies an onscreen keyboard,
	// 	// and that you probably don't want to use the keyboard to choose colors
	// 	if ($w.width() >= 300) {
	// 		inputs_by_component_letter.h.focus();
	// 	}
	// 	maybe_reenable_button_for_mobile_navigation();
	// });

	// for mobile layout, re-enable button because it's a navigation button in that case, rather than a one-off expando
	const maybe_reenable_button_for_mobile_navigation = ()=> {
		// if ($right.is(":hidden")) {
		if ($w.width() < 300 || document.body.classList.contains("eye-gaze-mode")) {
			$define_custom_colors_button.removeAttr("disabled");
		}
	};
	$(window).on("resize", maybe_reenable_button_for_mobile_navigation);

	// const $color_solid_label = $(`<label for="color-solid-canvas">${display_hotkey("Color")}</label>`);
	// $color_solid_label.css({
	// 	position: "absolute",
	// 	left: 10,
	// 	top: 255,
	// });

	const rainbow_canvas = make_canvas(175, 187);
	const luminosity_canvas = make_canvas(10, 187);
	const result_canvas = make_canvas(175, 60);
	const lum_arrow_canvas = make_canvas(5, 9);

	$(result_canvas).css({
		position: "absolute",
		left: 10,
		top: 198,
	});
	
	let mouse_down_on_rainbow_canvas = false;
	let crosshair_shown_on_rainbow_canvas = false;
	const draw = ()=> {
		if (!mouse_down_on_rainbow_canvas || crosshair_shown_on_rainbow_canvas) {
			// rainbow
			for (let y = 0; y < rainbow_canvas.height; y += 6) {
				for (let x = -1; x < rainbow_canvas.width; x += 3) {
					rainbow_canvas.ctx.fillStyle = `hsl(${x/rainbow_canvas.width*360}deg, ${(1-y/rainbow_canvas.height)*100}%, 50%)`;
					rainbow_canvas.ctx.fillRect(x, y, 3, 6);
				}
			}
			// crosshair
			if (!mouse_down_on_rainbow_canvas) {
				const x = ~~(hue_degrees/360*rainbow_canvas.width);
				const y = ~~((1-sat_percent/100)*rainbow_canvas.height);
				rainbow_canvas.ctx.fillStyle = "black";
				rainbow_canvas.ctx.fillRect(x-1, y-9, 3, 5);
				rainbow_canvas.ctx.fillRect(x-1, y+5, 3, 5);
				rainbow_canvas.ctx.fillRect(x-9, y-1, 5, 3);
				rainbow_canvas.ctx.fillRect(x+5, y-1, 5, 3);
			}
			crosshair_shown_on_rainbow_canvas = !mouse_down_on_rainbow_canvas;
		}

		for (let y = -2; y < luminosity_canvas.height; y += 6) {
			luminosity_canvas.ctx.fillStyle = `hsl(${hue_degrees}deg, ${sat_percent}%, ${(1-y/luminosity_canvas.height)*100}%)`;
			luminosity_canvas.ctx.fillRect(0, y, luminosity_canvas.width, 6);
		}

		lum_arrow_canvas.ctx.fillStyle = getComputedStyle($w.$content[0]).getPropertyValue("--ButtonText");
		for (let x = 0; x < lum_arrow_canvas.width; x++) {
			lum_arrow_canvas.ctx.fillRect(x, lum_arrow_canvas.width-x-1, 1, 1+x*2);
		}
		lum_arrow_canvas.style.position = "absolute";
		lum_arrow_canvas.style.left = "215px";
		lum_arrow_canvas.style.top = `${3 + ~~((1-lum_percent/100)*luminosity_canvas.height)}px`;

		result_canvas.ctx.fillStyle = get_current_color();
		result_canvas.ctx.fillRect(0, 0, result_canvas.width, result_canvas.height);
	};
	draw();
	$(rainbow_canvas).addClass("rainbow-canvas inset-shallow");
	$(luminosity_canvas).addClass("luminosity-canvas inset-shallow");
	$(result_canvas).addClass("result-color-canvas inset-shallow").attr("id", "color-solid-canvas");

	const select_hue_sat = (event)=> {
		hue_degrees = Math.min(1, Math.max(0, event.offsetX/rainbow_canvas.width))*360;
		sat_percent = Math.min(1, Math.max(0, (1 - event.offsetY/rainbow_canvas.height)))*100;
		update_inputs("hsrgb");
		draw();
		event.preventDefault();
	};
	$(rainbow_canvas).on("pointerdown", (event)=> {
		mouse_down_on_rainbow_canvas = true;
		select_hue_sat(event);
		
		$(rainbow_canvas).on("pointermove", select_hue_sat);
		if (event.pointerId !== 1234567890) { // for Eye Gaze Mode simulated clicks
			rainbow_canvas.setPointerCapture(event.pointerId);
		}
	});
	$G.on("pointerup pointercancel", (event)=> {
		$(rainbow_canvas).off("pointermove", select_hue_sat);
		// rainbow_canvas.releasePointerCapture(event.pointerId);
		mouse_down_on_rainbow_canvas = false;
		draw();
	});

	const select_lum = (event)=> {
		lum_percent = Math.min(1, Math.max(0, (1 - event.offsetY/luminosity_canvas.height)))*100;
		update_inputs("lrgb");
		draw();
		event.preventDefault();
	};
	$(luminosity_canvas).on("pointerdown", (event)=> {
		select_lum(event);
		
		$(luminosity_canvas).on("pointermove", select_lum);
		if (event.pointerId !== 1234567890) { // for Eye Gaze Mode simulated clicks
			luminosity_canvas.setPointerCapture(event.pointerId);
		}
	});
	$G.on("pointerup pointercancel", (event)=> {
		$(luminosity_canvas).off("pointermove", select_lum);
		// luminosity_canvas.releasePointerCapture(event.pointerId);
	});

	const inputs_by_component_letter = {};

	["hsl", "rgb"].forEach((color_model, color_model_index)=> {
		[...color_model].forEach((component_letter, component_index)=> {
			const text_with_hotkey = {
				h: "Hu&e:",
				s: "&Sat:",
				l: "&Lum:",
				r: "&Red:",
				g: "&Green:",
				b: "Bl&ue:",
			}[component_letter];
			const input = document.createElement("input");
			// not doing type="number" because the inputs have no up/down buttons and they have special behavior with validation
			input.type = "text";
			input.classList.add("inset-deep");
			input.dataset.componentLetter = component_letter;
			input.dataset.min = 0;
			input.dataset.max = {
				h: 360,
				s: 100,
				l: 100,
				r: 255,
				g: 255,
				b: 255,
			}[component_letter];
			const label = document.createElement("label");
			label.innerHTML = display_hotkey(text_with_hotkey);
			const input_y_spacing = 22;
			$(label).css({
				position: "absolute",
				left: 63 + color_model_index * 80,
				// top: 202 + component_index * input_y_spacing,
				top: -1000, // hide
				textAlign: "right",
				display: "inline-block",
				width: 40,
				height: 20,
				lineHeight: "20px",
			});
			$(input).css({
				position: "absolute",
				left: 106 + color_model_index * 80,
				// top: 202 + component_index * input_y_spacing + (component_index > 1), // spacing of rows is uneven by a pixel
				top: -1000, // hide
				width: 21,
				height: 14,
			});
			$right.append(label, input);

			inputs_by_component_letter[component_letter] = input;
		});
	});

	const hexLabelInputContainer = document.createElement("div");
	$(hexLabelInputContainer).css({paddingLeft: 49});

	const hexLabel = document.createElement("p");
	hexLabel.innerHTML = "Hex Code:";

	const hexInput = document.createElement("input");
	hexInput.isHex = true;
	hexInput.type = "text";
	hexInput.classList.add("inset-deep");
	$(hexLabel).css({
		left: 0,
		top: 0,
		textAlign: "right",
		display: "inline-block",
		width: 40,
		height: 20,
		lineHeight: "20px",
	});
	$(hexInput).css({
		left: 20,
		top: 0,
		width: 60,
		height: 14,
	});

	const hexErrorLabel = document.createElement("p");
	$(hexErrorLabel).css({
		color: "red",
		height: 10,
		marginTop: -7,
		marginLeft: 13,
	})
	hexLabelInputContainer.append(hexLabel, hexInput);
	$left.append(hexLabelInputContainer, hexErrorLabel);
	
	hexInput.value = "#";

	// Initialize mint form buttons and text


	// listening for input events on input elements using event delegation (looks a little weird)
	$left.on("input", "input", (event)=> {
		const input = event.target;
		const component_letter = input.dataset.componentLetter;
		if (input.isHex) {
			hexErrorLabel.innerHTML = '';
			resetColorForm();
			// Ensure hex starts with '#'
			if (input.value[0] !== "#") {
				input.value = "#" + input.value;
			}
			const hexColor = input.value;
			if (!is_hex_value(hexColor)) {
				hexErrorLabel.innerHTML = "Please input a correct 6 digit hex value";
			} else {
				hexErrorLabel.innerHTML = ''
				let newRgb = hex_to_rgb(input.value);
				set_color_from_rgb(newRgb.r, newRgb.g, newRgb.b);
				update_inputs("hsl");
				update_inputs("rgb");
				draw();
			}
		}
		else if (component_letter) {
			// In Windows, it actually only updates if the numerical value changes, not just the text.
			// That is, you can add leading zeros, and they'll stay, then add them in the other color model
			// and it won't remove the ones in the fields of the first color model.
			// This is not important, so I don't know if I'll do that.
			console.log('detected hsl or rgb change, running change.');
			if (input.value.match(/^\d+$/)) {
				let n = Number(input.value);
				if (n < input.dataset.min) {
					n = input.dataset.min;
					input.value = n;
				} else if (n > input.dataset.max) {
					n = input.dataset.max;
					input.value = n;
				}
				if ("hsl".indexOf(component_letter) > -1) {
					switch (component_letter) {
						case "h":
							hue_degrees = n;
							break;
						case "s":
							sat_percent = n;
							break;
						case "l":
							lum_percent = n;
							break;
					}
					update_inputs("rgb");
					// hexInput.value = rgb_to_hex(
					// 	inputs_by_component_letter['r'].value,
					// 	inputs_by_component_letter['g'].value,
					// 	inputs_by_component_letter['b'].value
					// );
				} else {
					let [r, g, b] = get_rgba_from_color(get_current_color());
					const rgb = {r, g, b};
					rgb[component_letter] = n;
					set_color_from_rgb(rgb.r, rgb.g, rgb.b);
					update_inputs("hsl");
					hexInput.value = rgb_to_hex(rgb.r, rgb.g, rgb.b);
				}
				draw();
			} else if (input.value.length) {
				update_inputs(component_letter);
				input.select();
			}
		}
	});

	$right.on("input", "input", (event)=> {
		const input = event.target;
		const component_letter = input.dataset.componentLetter;
		if (input.isHex) {
			// Ensure hex starts with '#'
			if (input.value[0] !== "#") {
				input.value = "#" + input.value;
			}
			const hexColor = input.value;
			if (!is_hex_value(hexColor)) {
				hexErrorLabel.innerHTML = "Please input a correct 6 digit hex value";
			} else {
				hexErrorLabel.innerHTML = ''
				let newRgb = hex_to_rgb(input.value);
				set_color_from_rgb(newRgb.r, newRgb.g, newRgb.b);
				update_inputs("hsl");
				update_inputs("rgb");
				draw();
			}
		}
		else if (component_letter) {
			// In Windows, it actually only updates if the numerical value changes, not just the text.
			// That is, you can add leading zeros, and they'll stay, then add them in the other color model
			// and it won't remove the ones in the fields of the first color model.
			// This is not important, so I don't know if I'll do that.
			console.log('detected hsl or rgb change, running change.');
			if (input.value.match(/^\d+$/)) {
				let n = Number(input.value);
				if (n < input.dataset.min) {
					n = input.dataset.min;
					input.value = n;
				} else if (n > input.dataset.max) {
					n = input.dataset.max;
					input.value = n;
				}
				if ("hsl".indexOf(component_letter) > -1) {
					switch (component_letter) {
						case "h":
							hue_degrees = n;
							break;
						case "s":
							sat_percent = n;
							break;
						case "l":
							lum_percent = n;
							break;
					}
					update_inputs("rgb");
					// hexInput.value = rgb_to_hex(
					// 	inputs_by_component_letter['r'].value,
					// 	inputs_by_component_letter['g'].value,
					// 	inputs_by_component_letter['b'].value
					// );
				} else {
					let [r, g, b] = get_rgba_from_color(get_current_color());
					const rgb = {r, g, b};
					rgb[component_letter] = n;
					set_color_from_rgb(rgb.r, rgb.g, rgb.b);
					update_inputs("hsl");
					hexInput.value = rgb_to_hex(rgb.r, rgb.g, rgb.b);
				}
				draw();
			} else if (input.value.length) {
				update_inputs(component_letter);
				input.select();
			}
		}
	});
	$right.on("focusout", "input", (event)=> {
		const input = event.target;
		const component_letter = input.dataset.componentLetter;
		if (component_letter) {
			// Handle empty input when focus moves away
			if (!input.value.match(/^\d+$/)) {
				update_inputs(component_letter);
				input.select();
			}
		}
	});

	$w.on("keydown", (event)=> {
		if (event.altKey) {
			switch (event.key) {
				case "o":
					set_color(get_current_color());
					update_inputs("hslrgb");
					draw();
					break;
				case "b":
					$basic_colors_grid.find(".swatch.selected, .swatch").focus();
					break;
				case "c":
					$basic_colors_grid.find(".swatch.selected, .swatch").focus();
					break;
				case "e":
					inputs_by_component_letter.h.focus();
					break;
				case "s":
					inputs_by_component_letter.s.focus();
					break;
				case "l":
					inputs_by_component_letter.l.focus();
					break;
				case "r":
					inputs_by_component_letter.r.focus();
					break;
				case "g":
					inputs_by_component_letter.g.focus();
					break;
				case "u":
					inputs_by_component_letter.b.focus();
					break;
				case "a":
					if ($add_to_custom_colors_button.is(":visible")) { 
						$add_to_custom_colors_button.click();
					}
					break;
				case "d":
					$define_custom_colors_button.click();
					break;
				default:
					return; // don't prevent default by default
			}
		} else {
			return; // don't prevent default by default
		}
		event.preventDefault();
		event.stopPropagation();
	});


	const update_inputs = (components)=> {
		hexErrorLabel.innerHTML = '';
		resetColorForm();
		for (const component_letter of components) {
			const input = inputs_by_component_letter[component_letter];
			const [r, g, b] = get_rgba_from_color(get_current_color());
			input.value = Math.floor({
				h: hue_degrees,
				s: sat_percent,
				l: lum_percent,
				r,
				g,
				b,
			}[component_letter]);
			hexInput.value = rgb_to_hex(r, g, b);
		}
	};

	// $right.append(rainbow_canvas, luminosity_canvas, result_canvas, $color_solid_label, lum_arrow_canvas);
	$right.append(rainbow_canvas, luminosity_canvas, result_canvas, lum_arrow_canvas);

	if (!isReadyForMinting) {
		show_error_message("You'll be able to mint a paint when the project is launched. To be the first to know when we launch, join our Discord with the link at the top of the page.")
	} else {
		$w.$Button(localize("Check availability"), () => {
			resetColorForm();
			$left.append(loadingElispes);
			if (!hexErrorLabel.innerText) {
				blockchain.updateColorList().then(function () {
					loadingElispes.remove();
					console.log('updated color list');
					if (blockchain.state.totalSupply >= 1024) {
						console.log('all 1024 paints minted');
						$left.append(allPaintsMintedContainer);
						return;
					}
					if (blockchain.state.colors.includes(hexInput.value)) {
						$left.append(colorNotAvailContainer);
					} else {
						// $left.append(`<p style="color: green;">This color is available.</p>`);
						// $left.append(`<p style="color: green;">Are you ready to make history?</p>`);
						$left.append(availableMgs1);
						$left.append(availableMgs2);
						mintButton.onclick = function(event) {
							event.preventDefault();
							genericErrorMsg.remove();
							walletErrorMsg.remove();
							mintSuccessMsg.remove();
							viewPaintMsg.remove();
							const colorToMint = hexInput.value;
							$left.append(mintWaitingMsg);
							blockchain.mint(colorToMint).then(function(res) {
								mintWaitingMsg.remove();
								blockchain.updateColorList();
								console.log(`res from edit colors`, res);
								$left.append(mintSuccessMsg);
								$left.append(viewPaintMsg);
							}).catch((mintError) => {
								console.log(`Error while trying to mint:`, mintError)
								mintWaitingMsg.remove();
								if (mintError.toString().includes("transaction requires a signer")) {
									$left.append(walletErrorMsg);
								} else {
									$left.append(genericErrorMsg);
								}
							})
						}
						$left.append(mintButton);
					}
				}).catch((availabilityError) => {
					loadingElispes.remove();
					console.log(`Error while checking color availability:`, availabilityError);
					$left.append(genericErrorMsg);
				})
			}
					
		});
		console.log(`$w.$buttons`, $w.$buttons);
	
		$left.append($w.$buttons);
		$('button:contains("Check availability")').css({left: 50});
	}


	// initially select the first color cell that matches the swatch to edit, if any
	// (first in the basic colors, then in the custom colors otherwise - implicitly)
	for (const swatch_el of $left.find(".swatch").toArray()) {
		if (get_rgba_from_color(swatch_el.dataset.color).join(",") === get_rgba_from_color(initial_color).join(",")) {
			select($(swatch_el));
			swatch_el.focus();
			break;
		}
	}
	// custom_colors_index = Math.max(0, custom_colors_swatches_list_order.indexOf(
	// 	$custom_colors_grid.find(".swatch.selected")[0]
	// ));
	
	set_color(initial_color);
	update_inputs("hslrgb");

	$w.center();
}

function resetColorForm() {
	mintButton.remove();
	availableMgs1.remove();
	availableMgs2.remove();
	colorNotAvailContainer.remove();
	genericErrorMsg.remove();
	walletErrorMsg.remove();
	mintSuccessMsg.remove();
	viewPaintMsg.remove();
}
