/* global simplePayForms, spGeneral, jQuery */

var simpayApp = {};

( function( $ ) {
	'use strict';

	var body;

	simpayApp = {

		// Collection of DOM elements of all payment forms
		spFormElList: {},

		// Internal organized collection of all form data
		spFormData: {},

		// Stripe Data?
		spStripeData: {},

		init: function() {

			// Set main vars on init.
			body = $( document.body );

			simpayApp.spFormElList = body.find( '.simpay-checkout-form' );

			simpayApp.spFormElList.each( function() {

				var spFormElem = $( this );
				simpayApp.setupCoreForm( spFormElem );

				body.trigger( 'simpaySetupCoreForm', [ spFormElem ] );
			} );

			body.trigger( 'simpayLoaded' );
		},

		// Does this payment form use the Stripe Checkout overlay?
		isStripeCheckoutForm: function( formData ) {
			return ( undefined === formData.formDisplayType || 'custom_fields_stripe_checkout' === formData.formDisplayType );
		},

		setupCoreForm: function( spFormElem ) {

			var formId = spFormElem.data( 'simpay-form-id' );

			// Grab the localized data for this form ID.
			var localizedFormData = simplePayForms[ formId ];

			// Set formData array index of the current form ID to match the localized data passed over for form settings.
			var formData = $.extend( {}, localizedFormData.form.integers, localizedFormData.form.bools, localizedFormData.form.strings );

			// Set form ID from data attribute.
			formData.formId = formId;

			// Set a finalAmount setting so that we can perform all the actions on this. That way if we need to reverse anything we leave the base amount untouched and can revert to it.
			formData.finalAmount = formData.amount;

			// Set the default quantity to 1.
			formData.quantity = 1;

			// Add a new object called stripeParams to the spFormData object. This contains only the stripeParams that need to be sent. This is so we don't have to manually set all the stripeParams
			// And we can just use what was passed from PHP so we only include the minimum needed and let Stripe defaults take care of anything that's missing here.
			formData.stripeParams = $.extend( {}, localizedFormData.stripe.strings, localizedFormData.stripe.bools );

			// Set a fallback button label.
			formData.oldPanelLabel = ( undefined !== formData.stripeParams.panelLabel ) ? formData.stripeParams.panelLabel : '';

			// Set button element class that will trigger payment form submit.
			// Different for Pro custom forms implementation.
			formData.submitBtnClass = 'simpay-payment-btn';

			body.trigger( 'simpayCoreFormVarsInitialized', [ spFormElem, formData ] );

			spShared.debugLog( 'formData.formDisplayType', formData.formDisplayType );

			if ( simpayApp.isStripeCheckoutForm( formData ) ) {
				simpayApp.setupStripeCheckout( spFormElem, formData );
			}

			simpayApp.spFormData[ formId ] = formData;

			body.trigger( 'simpayBindCoreFormEventsAndTriggers', [ spFormElem, formData ] );
		},

		setupStripeCheckout: function( spFormElem, formData ) {

			var submitBtn = spFormElem.find( '.' + formData.submitBtnClass );

			// Variable to hold the Stripe configuration.
			var stripeHandler = null;

			if ( submitBtn.length ) {

				// Stripe Checkout handler configuration.
				// Only token callback function set here. All other params set in stripeParams.
				// Chrome on iOS needs handler set before click event or else checkout won't open in a new tab.
				// See "How do I prevent the Checkout popup from being blocked?"
				// Full docs: https://stripe.com/docs/checkout#integration-custom
				stripeHandler = StripeCheckout.configure( {

					// Key param MUST be sent here instead of stripeHandler.open().
					key: formData.stripeParams.key,
					token: function( token, args ){
						handleStripeToken( token, args )
					},
					opened: function() {},
					closed: function() {}
				} );
			}

			/** Form submitted through checkout button click or Enter key. */

			function submitCoreForm() {

				// Init flag for form validation state.
				formData.isValid = true;

				// Trigger custom event right before executing payment.
				// For Pro version client-side validation and other client-side changes.
				spFormElem.trigger( 'simpayBeforeStripePayment', [ spFormElem, formData ] );

				// Now check validation state flag before continuing.
				// There are no validation checks in the Lite version natively.
				// But this is needed for Pro and/or custom code.
				if ( ! formData.isValid ) {
					return;
				}

				simpayApp.setCoreFinalAmount( spFormElem, formData );

				// Add in the final amount to Stripe params.
				// TODO Test accounting.js changes
				formData.stripeParams.amount = parseInt( formData.finalAmount );

				stripeHandler.open( formData.stripeParams );
			}

			/** Stripe token handler */

			// TODO DRY/Simplify/rename logic between core & pro?

			function handleStripeToken( token, args ) {

				var submitBtn = spFormElem.find( '.' + formData.submitBtnClass );

				// Set values to hidden elements to pass via POST when submitting the form for payment.
				spFormElem.find( '.simpay-stripe-token' ).val( token.id );
				spFormElem.find( '.simpay-stripe-email' ).val( token.email );

				// Handle extra (shipping) args.
				if ( args ) {
					simpayApp.handleStripeShippingArgs( spFormElem, args );
				}

				// Disable original form submit button and change text for UI feedback while POST-ing to Stripe.
				submitBtn
					.prop( 'disabled', true )
					.find( 'span' )
					.text( formData.loadingText );

				// Reset form submit handler to prevent an infinite loop.
				// Then finally submit the form.
				spFormElem.off( 'submit' );
				spFormElem.submit();
			}

			/** Original form submit handler */

			spFormElem.on( 'submit', function( e ) {
				e.preventDefault();
				submitCoreForm();
			} );
		},

		// Check & add extra shipping values if found.
		handleStripeShippingArgs: function( spFormElem, args ) {

			if ( args.shipping_name ) {
				spFormElem.find( '.simpay-shipping-name' ).val( args.shipping_name );
			}

			if ( args.shipping_address_country ) {
				spFormElem.find( '.simpay-shipping-country' ).val( args.shipping_address_country );
			}

			if ( args.shipping_address_zip ) {
				spFormElem.find( '.simpay-shipping-zip' ).val( args.shipping_address_zip );
			}

			if ( args.shipping_address_state ) {
				spFormElem.find( '.simpay-shipping-state' ).val( args.shipping_address_state );
			}

			if ( args.shipping_address_line1 ) {
				spFormElem.find( '.simpay-shipping-address-line1' ).val( args.shipping_address_line1 );
			}

			if ( args.shipping_address_city ) {
				spFormElem.find( '.simpay-shipping-city' ).val( args.shipping_address_city );
			}
		},

		// Set the internal final amount property value as well as the hidden form field.
		setCoreFinalAmount: function( spFormElem, formData ) {

			var finalAmount = formData.amount;

			spShared.debugLog( 'setCoreFinalAmount', formData );

			// TODO Test accounting.js changes
			formData.finalAmount = accounting.unformat( accounting.toFixed( finalAmount, 0 ) );

			// Fire trigger to do additional calculations in Pro.
			body.trigger( 'simpayFinalizeCoreAmount', [ spFormElem, formData ] );

			// Update amount hidden form field for processing.
			spFormElem.find( '.simpay-amount' ).val( formData.finalAmount );
		},

		formatMoney: function( amount ) {

			// Default format is to the left with no space
			var format = '%s%v';
			var options;

			// Convert our amount from cents to a formatted amount
			amount = simpayApp.convertFromCents( amount );

			// Set currency position based on settings
			if ( 'left_space' === spGeneral.strings.currencyPosition ) {

				//1 Left with a space
				format = '%s %v';
			} else if ( 'right' === spGeneral.strings.currencyPosition ) {

				// Right side no space
				format = '%v%s';
			} else if ( 'right_space' === spGeneral.strings.currencyPosition ) {

				// Right side with space
				format = '%v %s';
			}

			options = {
				symbol: spGeneral.strings.currencySymbol,
				decimal: spGeneral.strings.decimalSeparator,
				thousand: spGeneral.strings.thousandSeparator,
				precision: spGeneral.integers.decimalPlaces,
				format: format
			};

			return accounting.formatMoney( amount, options );
		},

		// TODO Test accounting.js changes
		convertFromCents: function( amount ) {

			if ( spGeneral.booleans.isZeroDecimal ) {
				return amount;
			} else {
				return accounting.unformat( accounting.toFixed( amount / 100, 2 ) );
			}
		},

		convertToCents: function( amount ) {

			if ( spGeneral.booleans.isZeroDecimal ) {
				return amount;
			} else {
				return amount * 100;
			}
		}
	};

	$( document ).ready( function( $ ) {
		simpayApp.init();
	} );

}( jQuery ) );
