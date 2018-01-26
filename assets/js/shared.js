/* global spGeneral, jQuery */

var spShared = {};

( function( $ ) {
	'use strict';

	var body;

	spShared = {

		init: function() {

			// Set main vars on init.
			body = $( document.body );

			// Validate & update amount input fields on focus out (blur).
			body.find( '.simpay-amount-input' ).on( 'blur.validateAndUpdateAmount', function( e ) {
				spShared.validateAndUpdateAmountInput( $( this ) );
			} );

			// Trigger all amount input fields on page load.
			body.find( '.simpay-amount-input' ).trigger( 'blur.validateAndUpdateAmount' );
		},

		/**
		 * Return amount as number value.
		 * Uses global decimal separator setting ("." or ",").
		 * accounting.unformat removes formatting/cruft first.
		 * Also prevent negative values.
		 * @returns number
		 */
		unformatCurrency: function( amount ) {
			return Math.abs( accounting.unformat( amount, spGeneral.strings.decimalSeparator ) );
		},

		/**
		 * Convert from cents to dollars (in USD).
		 * Or decimal to non-decimal for non-zero decimal currencies.
		 * Uses global zero decimal currency setting.
		 * Leaves zero decimal currencies alone.
		 * @returns number
		 */
		convertToDollars: function( amount ) {

			if ( !spGeneral.booleans.isZeroDecimal ) {
				amount = accounting.toFixed( amount / 100, 2 );
			}

			return spShared.unformatCurrency( amount );
		},

		/**
		 * Convert from dollars to cents (in USD).
		 * Or non-decimal to decimal for non-zero decimal currencies.
		 * Uses global zero decimal currency setting.
		 * Leaves zero decimal currencies alone.
		 * @returns number
		 */
		convertToCents: function( amount ) {

			if ( !spGeneral.booleans.isZeroDecimal ) {
				amount = amount * 100;
			}

			return amount;
		},

		/**
		 * Return amount as formatted string.
		 * With or without currency symbol.
		 * Used for labels & amount inputs in admin & front-end.
		 * Uses global currency settings.
		 * @returns string
		 */
		formatCurrency: function( amount, includeSymbol ) {

			// Default format is to the left with no space.
			var format = '%s%v',
				args;

			// Include symbol param = false if omitted.
			includeSymbol = includeSymbol || false;

			if ( includeSymbol ) {

				// Account for other symbol placement formats (besides default left without space).
				switch ( spGeneral.strings.currencyPosition ) {

					case 'left_space':
						format = '%s %v'; // Left side with space
						break;

					case 'right':
						format = '%v%s'; // Right side without space
						break;

					case 'right_space':
						format = '%v %s'; // Right side with space
						break;
				}
			}

			args = {
				symbol: includeSymbol ? spGeneral.strings.currencySymbol : '',
				decimal: spGeneral.strings.decimalSeparator,
				thousand: spGeneral.strings.thousandSeparator,
				precision: spGeneral.integers.decimalPlaces,
				format: format
			};

			return accounting.formatMoney( amount, args );
		},

		/**
		 * Validate amount field client-side and update according to rules set by CSS classes.
		 * Some fields display blank instead of "0.00" or "0".
		 * Some fields require a minimum of "1.00" or "100" (100 currency units).
		 * Invalid characters and the negative symbol will be removed.
		 */
		validateAndUpdateAmountInput: function( el ) {

			// Amount is intially a string.
			var amount = el.val();

			var globalMinAmount = Math.abs( spGeneral.integers.minAmount );

			// Convert amount to number value.
			amount = spShared.unformatCurrency( amount );

			// Update amount field to blank if specific class is present.
			// If zero, convert to blank and exit function.
			// Ex: Default Custom Amount, Setup Fee
			if ( el.hasClass( 'simpay-allow-blank-amount' ) ) {
				if ( 0 === amount ) {
					el.val( '' );
					return;
				}
			}

			// Validate & update fields to the global minimum amount (usually $1.00) if specific class is present.
			// Namely this is just on admin pages, separate from the custom amount minimum amount set per form.
			// Ex: One-Time Amount, Minimum Custom Amount
			if ( el.hasClass( 'simpay-minimum-amount-required' ) ) {
				if ( amount < globalMinAmount ) {
					amount = globalMinAmount;
				}
			}

			// Convert amount back to string with proper thousands & decimal separators, but without symbol.
			amount = spShared.formatCurrency( amount, false );

			// Update format price string in input field.
			el.val( amount );
		},

		// Log to console if SCRIPT_DEBUG PHP constant set to true.
		debugLog: function( key, value ) {

			if ( ( 'undefined' !== typeof spGeneral ) && ( true === spGeneral.booleans.scriptDebug ) ) {
				console.log( key, value );
			}
		}
	};

	$( document ).ready( function( $ ) {
		spShared.init();
	} );

}( jQuery ) );
