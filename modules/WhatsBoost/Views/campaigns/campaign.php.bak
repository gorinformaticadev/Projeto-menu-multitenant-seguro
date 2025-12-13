<div id="page-content" class="page-wrapper clearfix custom_whatsboost">
    <h4 class="fw-semibold"><?php echo app_lang('send_new_campaign'); ?></h4>
    <?php echo form_open_multipart(get_uri('whatsboost/campaigns/save'), ['id' => 'campaign_form']); ?>
    <input type="hidden" name="id" id="id" value="<?php echo $campaign['id'] ?? ''; ?>" class="temp_id">
    <div class="row">
        <div class="col-md-4">
            <div class="card rounded-bottom">
                <div class="card-header">
                    <h5 class=""><?php echo app_lang('campaign'); ?></h5>
                </div>
                <div class="card-body">
                    <div class="form-group">
                        <span class="text-danger">*</span>
                        <label for="campaign_name" class="form-label"><?php echo app_lang('campaign_name'); ?></label>
                        <?php echo form_input([
                            'id'                 => 'name',
                            'name'               => 'name',
                            'value'              => $campaign['name'] ?? '',
                            'class'              => 'form-control',
                            'data-rule-required' => true,
                            'data-msg-required'  => app_lang('field_required'),
                            'placeholder'        => '',
                        ]); ?>
                    </div>

                    <div class="form-group">
                        <span class="text-danger">*</span>
                        <label for="relation_type" class="form-label"><?php echo app_lang('relation_type'); ?></label>
                        <?php echo form_dropdown([
                            'name'               => 'rel_type',
                            'id'                 => 'rel_type',
                            'class'              => 'form-control validate-hidden select2',
                            'data-rule-required' => true,
                            'data-msg-required'  => app_lang('field_required'),
                        ], wbGetRelType(), $campaign['rel_type'] ?? ''); ?>
                    </div>
                    <div class="form-group">
                        <label for="template" class="form-label"><?php echo app_lang('template'); ?></label>
                        <?php echo form_dropdown([
                            'name'               => 'template_id',
                            'id'                 => 'template_id',
                            'class'              => 'form-control validate-hidden select2',
                            'data-rule-required' => true,
                            'data-msg-required'  => app_lang('field_required'),
                        ], wbGetTemplateList(), $campaign['template_id'] ?? ''); ?>
                    </div>
                    <div id="rel_id_wrapper" class="form-group hide">
                        <hr>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" value="1" name="select_all" id="select_all" <?php echo isset($campaign) && 1 == $campaign['select_all'] ? 'checked' : ''; ?>>
                            <label class="form-check-label" for="select_all">
                                <?php echo app_lang('send_to_all'); ?> <span class="rel_id_label"></span>
                            </label>
                        </div>
                        <div style="width: 100%; height: 10px; border-bottom: 1px solid #ddd; text-align: center; margin: 20px 0px">
                            <span style="font-size: 15px; background-color: #fff; padding: 0 4px;">
                                <?php echo app_lang('or'); ?>
                            </span>
                        </div>
                        <div id="leads_dropdown">
                            <span class="text-danger">*</span>
                            <label for="rel_id"><?php echo app_lang('send_to'); ?>: <span class="rel_id_label"></span></label>
                            <div id="rel_id_select">
                                <select name="rel_id[]" id="rel_id" class="form-control leads_dropdown validate-hidden rel_id" data-rule-required="1" data-msg-required="<?php echo app_lang('field_required'); ?>" tabindex="-1" multiple>
                                    <option value=""></option>
                                    <?php foreach ($lead as $key => $value) { ?>
                                        <option value="<?php echo $value['id']; ?>" <?php echo (isset($campaign) && (isset($campaign['lead_ids']) && in_array($value['id'], $campaign['lead_ids']))) ? 'selected' : ''; ?>><?php echo $value['company_name']; ?></option>
                                    <?php } ?>
                                </select>
                            </div>
                        </div>
                        <div id="contacts_dropdown">
                            <span class="text-danger">*</span>
                            <label for="rel_id"><?php echo app_lang('send_to'); ?>: <span class="rel_id_label"></span></label>
                            <div id="rel_id_select">
                                <select name="rel_id[]" id="rel_id" class="form-control contacts_dropdown validate-hidden rel_id" data-rule-required="1" data-msg-required="<?php echo app_lang('field_required'); ?>" tabindex="-1" multiple>
                                    <option value=""></option>
                                    <?php foreach ($customers as $key => $value) { ?>
                                        <option value="<?php echo $value['id']; ?>" <?php echo (isset($campaign) && (isset($campaign['contact_ids']) && in_array($value['id'], $campaign['contact_ids']))) ? 'selected' : ''; ?>><?php echo $value['company_name']; ?></option>
                                    <?php } ?>
                                </select>
                            </div>
                        </div>
                        <hr />
                    </div>

                    <div class="form-group">
                        <div class="row">
                            <div class="col-md-12">
                                <span class="text-danger">*</span>
                                <label for="scheduled_send_time"><?php echo app_lang('scheduled_send_time'); ?></label>
                            </div>
                            <div class="col-md-6">
                                <?php echo form_input([
                                    'id'                 => 'send_date',
                                    'name'               => 'send_date',
                                    'value'              => $campaign['send_date'] ?? '',
                                    'class'              => 'form-control',
                                    'placeholder'        => app_lang('send_date'),
                                    'autocomplete'       => 'off',
                                    'data-rule-required' => true,
                                    'data-msg-required'  => app_lang('field_required'),
                                ]); ?>
                            </div>
                            <div class="col-md-6">
                                <?php echo form_input([
                                    'id'                 => 'send_time',
                                    'name'               => 'send_time',
                                    'value'              => $campaign['send_time'] ?? '',
                                    'class'              => 'form-control',
                                    'placeholder'        => app_lang('send_time'),
                                    'data-rule-required' => true,
                                    'data-msg-required'  => app_lang('field_required'),
                                ]); ?>
                            </div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="send_now" class="form-control-label"><?php echo app_lang('ignore_scheduled_time_and_send_now'); ?></label>
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" role="switch" id="flexSwitchCheckChecked" value="1" name="send_now" <?php echo (isset($campaign) && '1' == $campaign['send_now']) ? 'checked' : ''; ?>>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="variableDetailsFirst col-md-4 hide">
            <div class="card rounded-bottom">
                <div class="card-header">
                    <h5 class=""><?php echo app_lang('variables'); ?></h5>
                    <span class="text-muted"><?php echo app_lang('merge_field_note'); ?></span>
                </div>
                <div class="card-body">
                    <div class="variables"></div>
                </div>
            </div>
        </div>

        <div class="variableDetailsSecond col-md-4 hide">
            <div class="row" id="preview_message">
                <div class="col-md-12">
                    <div class="card rounded-bottom">
                        <div class="card-header">
                            <h5 class=""><?php echo app_lang('preview'); ?></h5>
                        </div>
                        <div class="" style="background: url('<?php echo base_url(PLUGIN_URL_PATH . 'WhatsBoost/assets/images/bg.png'); ?>');">
                            <div class="card-body">
                                <div class="wb_panel previewImage">
                                </div>
                                <div class="card m-0">
                                    <div class="card-body previewmsg">
                                    </div>
                                </div>
                                <div class="previewBtn">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col-md-12">
                    <div class="card rounded-bottom">
                        <div class="card-header">
                            <h5 class=""><?php echo app_lang('send_campaign'); ?></h5>
                        </div>
                        <div class="card-body">
                            <p><?php echo app_lang('send_to'); ?> : <span class="totalCount"></span></p>
                            <button type="submit" class="btn btn-danger mtop15"><?php echo app_lang('send_campaign'); ?></button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <?php echo form_close(); ?>
</div>
<script>
    "use strict";
    $('#rel_type, #template_id, .rel_id').select2();
    setDatePicker("#send_date");
    setTimePicker("#send_time");

    var _rel_id = $('.rel_id'),
        _rel_type = $('#rel_type'),
        _rel_id_wrapper = $('#rel_id_wrapper'),
        data = {};

    $('.leads_dropdown').prop("disabled", true);
    $('.contacts_dropdown').prop("disabled", true);
    $('.rel_id_label').html(_rel_type.find('option:selected').text());

    _rel_type.on('change', function() {
        var value = $(this).val();
        if (value != '') {
            _rel_id_wrapper.removeClass('hide');
            if (value == 'leads') {
                $('#leads_dropdown').removeClass('hide');
                $('#contacts_dropdown').addClass('hide');
            }
            if (value == 'contacts') {
                $('#leads_dropdown').addClass('hide');
                $('#contacts_dropdown').removeClass('hide');
            }
        } else {
            _rel_id_wrapper.addClass('hide');
        }
        $('.rel_id_label').html(_rel_type.find('option:selected').text());
        $('#select_all').trigger('change');
    });

    $("#select_all").on('change', function() {
        var selected_rel_type = _rel_type.find('option:selected').val();
        if ($(this).is(':checked')) {
            $('.' + selected_rel_type + '_dropdown').prop("disabled", true);
        } else {
            $('.' + selected_rel_type + '_dropdown').prop("disabled", false);
        }

        if ($(this).is(':checked')) {
            let totalCount = (_rel_type.find('option:selected').val() == 'leads') ? "<?php echo ($total_leads ?? '') . ' ' . app_lang('leads'); ?>" : "<?php echo ($total_contacts ?? '') . ' ' . app_lang('contacts'); ?>";
            $('.totalCount').text(totalCount);
        } else {
            $('.totalCount').text($('.rel_id').find('option:selected').length + ' ' + _rel_type.find('option:selected').text());
        }
    })

    $(document).on('change', '.rel_id', function() {
        const selectedCount = $(this).find('option:selected').length;
        $('.totalCount').text(selectedCount + ' ' + $('#rel_type :selected').text());
    });

    $('#flexSwitchCheckChecked').on('change', function(e) {
        $('#send_date').prop("disabled", false);
        $('#send_time').prop("disabled", false);
        if ($('#flexSwitchCheckChecked').prop('checked')) {
            $('#send_date').prop("disabled", true);
            $('#send_time').prop("disabled", true);
        }
    });

    window.campaignForm = $("#campaign_form").appForm({
        isModal: false,
        onSuccess: function(response) {
            appAlert.success(response.message, {
                duration: 3000
            });
            setTimeout(function() {
                window.location.href = response.recirect_to;
            }, 3000);
        }
    });

    $(function() {
        <?php if (isset($campaign)) { ?>
            setTimeout(function() {
                $('#template_id').trigger('change');
                $('#rel_type').trigger('change');
                $('#select_all').trigger('change');
                $('#flexSwitchCheckChecked').trigger('change');
                setTimeout(function() {
                    $('.header_image').trigger('change');
                }, 200);
            }, 0);
        <?php } ?>

    })
</script>
