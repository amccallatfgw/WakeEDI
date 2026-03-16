-- ============================================================================
-- WakeEDI — Migration 004: Standard 204 Load Tender Mapping Template
-- Pre-built SARA mapping rules that cover the standard 204 → FreightWake flow.
-- Partners clone this template and adjust per their specific requirements.
-- ============================================================================

-- ── Template: 204 Inbound → FreightWake Orders ──────────────────────────────

DECLARE @mapping_id INT;

INSERT INTO mapping_profiles (partner_id, name, tx_set, direction, target_app, description, is_template, is_active)
VALUES (NULL, 'Standard 204 → FreightWake', '204', 'inbound', 'freightwake',
    'Standard Load Tender mapping. Maps B2 header to orders table, S5 loops to order_stops. Clone this template for new partners.', 1, 1);

SET @mapping_id = SCOPE_IDENTITY();

-- ── Header rules (B2 segment → orders table) ────────────────────────────────

-- B2/02 — SCAC code (carrier identifier)
INSERT INTO mapping_rules (mapping_id, x12_path, x12_segment, x12_element, x12_loop, target_table, target_column, transform, is_required, sort_order, notes)
VALUES (@mapping_id, 'B2/02', 'B2', 2, NULL, 'orders', 'carrier_scac', 'trim', 0, 1, 'Standard Carrier Alpha Code');

-- B2/04 — Shipment ID / Customer Reference
INSERT INTO mapping_rules (mapping_id, x12_path, x12_segment, x12_element, x12_loop, target_table, target_column, transform, is_required, sort_order, notes)
VALUES (@mapping_id, 'B2/04', 'B2', 4, NULL, 'orders', 'customer_ref', 'trim', 1, 2, 'Shipment identification number — becomes the customer reference on the order');

-- B2/06 — Payment method code
INSERT INTO mapping_rules (mapping_id, x12_path, x12_segment, x12_element, x12_loop, target_table, target_column, transform, transform_args, is_required, sort_order, notes)
VALUES (@mapping_id, 'B2/06', 'B2', 6, NULL, 'orders', 'payment_method', 'lookup', 'payment_method', 0, 3, 'CC=collect, PP=prepaid, TP=third_party');

-- B2A/01 — Purpose code (00=original, 01=cancel, 04=change)
INSERT INTO mapping_rules (mapping_id, x12_path, x12_segment, x12_element, x12_loop, target_table, target_column, transform, is_required, sort_order, notes)
VALUES (@mapping_id, 'B2A/01', 'B2A', 1, NULL, 'orders', 'edi_purpose_code', 'trim', 0, 4, '00=original, 01=cancel, 04=change');

-- ── Equipment type (from first L11 with qualifier EQ, or MS3 segment) ────────

INSERT INTO mapping_rules (mapping_id, x12_path, x12_segment, x12_element, x12_loop, target_table, target_column, transform, transform_args, is_required, sort_order, notes)
VALUES (@mapping_id, 'MS3/04', 'MS3', 4, NULL, 'orders', 'equipment_type', 'lookup', 'equipment_type', 0, 5, 'Equipment type from MS3 segment');

-- ── Static fields ────────────────────────────────────────────────────────────

INSERT INTO mapping_rules (mapping_id, x12_path, x12_segment, x12_element, x12_loop, target_table, target_column, transform, transform_args, default_value, is_required, sort_order, notes)
VALUES (@mapping_id, 'STATIC/status', 'B2', 1, NULL, 'orders', 'status', 'static', NULL, 'pending', 0, 10, 'New EDI orders always start as pending');

INSERT INTO mapping_rules (mapping_id, x12_path, x12_segment, x12_element, x12_loop, target_table, target_column, transform, transform_args, default_value, is_required, sort_order, notes)
VALUES (@mapping_id, 'STATIC/source', 'B2', 1, NULL, 'orders', 'source', 'static', NULL, 'edi_204', 0, 11, 'Mark source as EDI 204 for tracking');

INSERT INTO mapping_rules (mapping_id, x12_path, x12_segment, x12_element, x12_loop, target_table, target_column, transform, transform_args, default_value, is_required, sort_order, notes)
VALUES (@mapping_id, 'STATIC/order_type', 'B2', 1, NULL, 'orders', 'order_type', 'static', NULL, 'brokered', 0, 12, 'Default order type');

-- ── Stop rules (S5 loop → order_stops table) ────────────────────────────────

-- S5/01 — Stop sequence number
INSERT INTO mapping_rules (mapping_id, x12_path, x12_segment, x12_element, x12_loop, target_table, target_column, transform, is_required, sort_order, notes)
VALUES (@mapping_id, 'S5/01', 'S5', 1, 'S5', 'order_stops', 'stop_sequence', 'integer', 1, 20, 'Stop sequence (1, 2, 3...)');

-- S5/02 — Stop reason code (CL=pickup, CU=delivery, LD=load, UL=unload)
INSERT INTO mapping_rules (mapping_id, x12_path, x12_segment, x12_element, x12_loop, target_table, target_column, transform, transform_args, is_required, sort_order, notes)
VALUES (@mapping_id, 'S5/02', 'S5', 2, 'S5', 'order_stops', 'stop_type', 'lookup', 'stop_reason', 1, 21, 'CL/LD=pickup, CU/UL=delivery');

-- S5/03 — Weight
INSERT INTO mapping_rules (mapping_id, x12_path, x12_segment, x12_element, x12_loop, target_table, target_column, transform, is_required, sort_order, notes)
VALUES (@mapping_id, 'S5/03', 'S5', 3, 'S5', 'order_stops', 'weight_lbs', 'decimal', 0, 22, 'Weight at this stop');

-- S5/05 — Number of units/pieces
INSERT INTO mapping_rules (mapping_id, x12_path, x12_segment, x12_element, x12_loop, target_table, target_column, transform, is_required, sort_order, notes)
VALUES (@mapping_id, 'S5/05', 'S5', 5, 'S5', 'order_stops', 'pieces', 'integer', 0, 23, 'Piece count at this stop');

-- N1/02 — Entity name (shipper/consignee name)
INSERT INTO mapping_rules (mapping_id, x12_path, x12_segment, x12_element, x12_loop, target_table, target_column, transform, is_required, sort_order, notes)
VALUES (@mapping_id, 'N1/02', 'N1', 2, 'S5', 'order_stops', 'contact_name', 'trim', 0, 25, 'Location/facility name from N1 segment');

-- N3/01 — Street address
INSERT INTO mapping_rules (mapping_id, x12_path, x12_segment, x12_element, x12_loop, target_table, target_column, transform, is_required, sort_order, notes)
VALUES (@mapping_id, 'N3/01', 'N3', 1, 'S5', 'order_stops', 'address1', 'trim', 0, 26, 'Street address line 1');

-- N4/01 — City
INSERT INTO mapping_rules (mapping_id, x12_path, x12_segment, x12_element, x12_loop, target_table, target_column, transform, is_required, sort_order, notes)
VALUES (@mapping_id, 'N4/01', 'N4', 1, 'S5', 'order_stops', 'city', 'trim', 0, 27, 'City');

-- N4/02 — State
INSERT INTO mapping_rules (mapping_id, x12_path, x12_segment, x12_element, x12_loop, target_table, target_column, transform, is_required, sort_order, notes)
VALUES (@mapping_id, 'N4/02', 'N4', 2, 'S5', 'order_stops', 'state', 'trim', 0, 28, 'State code (2 chars)');

-- N4/03 — Zip
INSERT INTO mapping_rules (mapping_id, x12_path, x12_segment, x12_element, x12_loop, target_table, target_column, transform, is_required, sort_order, notes)
VALUES (@mapping_id, 'N4/03', 'N4', 3, 'S5', 'order_stops', 'zip', 'trim', 0, 29, 'Postal code');

-- G62/02 — Scheduled date (qualifier 10=pickup, 02=delivery, 68=appointment)
INSERT INTO mapping_rules (mapping_id, x12_path, x12_segment, x12_element, x12_loop, target_table, target_column, transform, is_required, sort_order, notes)
VALUES (@mapping_id, 'G62/02', 'G62', 2, 'S5', 'order_stops', 'sched_arrive', 'date', 0, 30, 'Scheduled date (CCYYMMDD format)');

-- G62/04 — Scheduled time
INSERT INTO mapping_rules (mapping_id, x12_path, x12_segment, x12_element, x12_loop, target_table, target_column, transform, is_required, sort_order, notes)
VALUES (@mapping_id, 'G62/04', 'G62', 4, 'S5', 'order_stops', 'appt_open', 'time', 0, 31, 'Appointment time (HHMM format)');

-- ── Template: 214 Outbound → Status Update ──────────────────────────────────

INSERT INTO mapping_profiles (partner_id, name, tx_set, direction, target_app, description, is_template, is_active)
VALUES (NULL, 'Standard 214 Outbound', '214', 'outbound', 'freightwake',
    'Standard Shipment Status mapping. Reads FreightWake order status and generates 214 AT7 segments.', 1, 1);

-- ── Template: 990 Outbound → Tender Response ────────────────────────────────

INSERT INTO mapping_profiles (partner_id, name, tx_set, direction, target_app, description, is_template, is_active)
VALUES (NULL, 'Standard 990 Response', '990', 'outbound', 'freightwake',
    'Standard Response to Load Tender. Auto-generates accept/decline based on order status.', 1, 1);
