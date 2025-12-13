<div id="page-content" class="page-wrapper clearfix custom_whatsboost">
    <h4 class="fw-semibold"><?php echo app_lang('create_new_template_bot'); ?></h4>
    <?php echo form_open_multipart(get_uri('whatsboost/bots/template/save'), ['id' => 'template_bot_form'], ['is_bot' => $bot['is_bot'] ?? '1', 'is_bot_active' => $bot['is_bot_active'] ?? '1']); ?>
    <input type="hidden" name="id" id="id" value="<?php echo $bot['id'] ?? ''; ?>" class="temp_id">
    <div class="row">
        <div class="col-md-4">
            <div class="card rounded-bottom">
                <div class="card-header">
                    <h5 class=""><?php echo app_lang('template_bot'); ?></h5>
                </div>
                <div class="card-body">
                    <div class="form-group">
                        <span class="text-danger">*</span>
                        <label for="name" class="form-label"><?php echo app_lang('bot_name'); ?></label>
                        <?php echo form_input([
                            'id'                 => 'name',
                            'name'               => 'name',
                            'value'              => $bot['name'] ?? '',
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
                        ], wbGetRelType(), $bot['rel_type'] ?? []); ?>
                    </div>

                    <div class="form-group">
                        <span class="text-danger">*</span>
                        <label for="template" class="form-label"><?php echo app_lang('template'); ?></label>
                        <?php echo form_dropdown([
                            'name'               => 'template_id',
                            'id'                 => 'template_id',
                            'class'              => 'form-control validate-hidden select2',
                            'data-rule-required' => true,
                            'data-msg-required'  => app_lang('field_required'),
                        ], wbGetTemplateList(), $bot['template_id'] ?? []); ?>
                    </div>

                    <div class="form-group">
                        <span class="text-danger">*</span>
                        <label for="reply_type" class="form-label"><?php echo app_lang('reply_type'); ?></label>
                        <?php echo form_dropdown([
                            'name'               => 'bot_type',
                            'id'                 => 'bot_type',
                            'class'              => 'form-control validate-hidden select2',
                            'data-rule-required' => true,
                            'data-msg-required'  => app_lang('field_required'),
                        ], wbGetReplyType(), $bot['bot_type'] ?? []); ?>
                    </div>

                    <div class="form-group">
                        <span class="text-danger">*</span>
                        <label for="trigger" class="form-label"><?php echo app_lang('trigger'); ?></label>
                        <?php echo form_input([
                            'id'                 => 'trigger',
                            'name'               => 'trigger',
                            'value'              => $bot['trigger'] ?? '',
                            'class'              => 'form-control',
                            'data-rule-required' => true,
                            'data-msg-required'  => app_lang('field_required'),
                            'placeholder'        => '',
                        ]); ?>
                    </div>

                    <button type="submit" class="btn btn-success mtop15"><?php echo app_lang('save_bot'); ?></button>

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
                        <div class="" style="background: url('<?php echo base_url(PLUGIN_URL_PATH.'WhatsBoost/assets/images/bg.png'); ?>');">
                            <div class="card-body">
                                <div class="card m-0">
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
                </div>
            </div>
        </div>
    </div>
    <?php echo form_close(); ?>
</div>
<script>
    "use strict";
    $('#rel_type, #template_id, #rel_id, #bot_type').select2();

    window.templateBotForm = $("#template_bot_form").appForm({
        isModal: false,
        onSuccess: function(response) {
            if (response.type == 'success') {
                appAlert.success(response.message, {
                    duration: 10000
                });
            } else {
                appAlert.error(response.message, {
                    duration: 10000
                });
            }
            setTimeout(() => {
                window.location = "<?php echo site_url('whatsboost/bots/template_bot'); ?>";
            }, 1000);
        }
    });

    $(function() {
        <?php if (isset($bot)) { ?>
            $('#rel_type').trigger('change');
            $('#template_id').trigger('change');
            setTimeout(function() {
                $('.header_image').trigger('change');
            }, 200);
        <?php } ?>
    });
</script>
