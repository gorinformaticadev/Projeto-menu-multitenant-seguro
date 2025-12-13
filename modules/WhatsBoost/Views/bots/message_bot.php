<div id="page-content" class="page-wrapper clearfix custom_whatsboost">
    <h4 class="fw-semibold"><?php echo (isset($bot)) ? app_lang('edit') . ' #' . $bot['name'] : app_lang('new_message_bot'); ?>
    </h4>
    <?php echo form_open_multipart(get_uri('whatsboost/bots/message/save'), ['id' => 'message_bot_form', 'novalidate' => false], ['id' => $bot['id'] ?? '']); ?>
    <div class="row">
        <div class="col-md-6">
            <div class="card">
                <div class="card-body">
                    <input type="hidden" name="addedfrom" value="<?php echo isset($bot) ? $bot['addedfrom'] : $user->id; ?>">
                    <div class="row">
                        <div class="form-group col-md-12">
                            <span class="text-danger">*</span>
                            <label for="campaign_name" class="form-label"><?php echo app_lang('bot_name'); ?></label>
                            <?php echo form_input([
                                'id'                 => 'name',
                                'name'               => 'name',
                                'value'              => $bot['name'] ?? '',
                                'class'              => 'form-control',
                                'data-rule-required' => true,
                                'data-msg-required'  => app_lang('field_required'),
                                'placeholder'        => 'Enter name',
                            ]); ?>
                        </div>

                        <div class="form-group col-md-12">
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

                        <div class="form-group col-md-12">
                            <span class="text-danger">*</span>
                            <label for="reply_text" class="form-label"><?php echo app_lang('reply_text'); ?><span class="help ml2 help_reply_text" data-container="body" data-bs-toggle="tooltip" title="<?php echo sprintf(app_lang('reply_text_note'), 'contact'); ?>" data-bs-placement="right"><i data-feather="help-circle" class="icon-16"></i></span></label>
                            <?php echo form_textarea([
                                'id'                    => 'reply_text',
                                'name'                  => 'reply_text',
                                'value'                 => $bot['reply_text'] ?? '',
                                'class'                 => 'form-control mentionable',
                                'data-rule-required'    => true,
                                'data-msg-required'     => app_lang('field_required'),
                                'style'                 => 'height:150px;',
                                'data-rich-text-editor' => true,
                                'maxlength'             => '2024',
                            ]); ?>
                        </div>

                        <div class="form-group col-md-12">
                            <span class="text-danger">*</span>
                            <label for="reply_type" class="form-label"><?php echo app_lang('reply_type'); ?></label>
                            <?php echo form_dropdown([
                                'name'               => 'reply_type',
                                'id'                 => 'reply_type',
                                'class'              => 'form-control validate-hidden select2',
                                'data-rule-required' => true,
                                'data-msg-required'  => app_lang('field_required'),
                            ], wbGetReplyType(), $bot['reply_type'] ?? []); ?>
                        </div>

                        <div class="form-group col-md-12">
                            <span class="text-danger">*</span>
                            <span class="ml2" data-container="body" data-bs-toggle="tooltip" title="<?php echo app_lang('use_multiple_keyword_note'); ?>" data-bs-placement="left"><i data-feather="help-circle" class="icon-16"></i></span>
                            <label for="trigger" class="form-label"><?php echo app_lang('trigger'); ?></label>
                            <?php echo form_input([
                                'id'                 => 'trigger',
                                'name'               => 'trigger',
                                'value'              => $bot['trigger'] ?? '',
                                'class'              => 'form-control',
                                'data-rule-required' => true,
                                'data-msg-required'  => app_lang('field_required'),
                                'placeholder'        => 'Enter bot reply trigger',
                            ]); ?>
                        </div>

                        <div class="form-group col-md-12">
                            <label for="header" class="form-label"><?php echo app_lang('header'); ?></label>
                            <?php echo form_input([
                                'id'          => 'bot_header',
                                'name'        => 'bot_header',
                                'value'       => $bot['bot_header'] ?? '',
                                'placeholder' => 'Enter header',
                                'class'       => 'form-control',
                            ]); ?>
                        </div>

                        <div class="form-group col-md-12">
                            <span class="ml2" data-container="body" data-bs-toggle="tooltip" title="<?php echo app_lang('maximum_allowed_characters_60'); ?>" data-bs-placement="left"><i data-feather="help-circle" class="icon-16"></i></span>
                            <label for="footer" class="form-label"><?php echo app_lang('footer'); ?></label>
                            <?php echo form_input([
                                'id'          => 'bot_footer',
                                'name'        => 'bot_footer',
                                'value'       => $bot['bot_footer'] ?? '',
                                'placeholder' => 'Enter footer',
                                'class'       => 'form-control',
                                'maxlength'   => '60',
                            ]); ?>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-md-6">
            <div class="card">
                <div class="card-body">
                    <h5 class="mb-4"><?php echo app_lang('option_bot_with_reply_buttons'); ?></h5>
                    <div class="row">
                        <div class="form-group col-md-6">
                            <span class="ml2" data-container="body" data-bs-toggle="tooltip" title="<?php echo app_lang('maximum_allowed_characters_20'); ?>" data-bs-placement="left"><i data-feather="help-circle" class="icon-16"></i></span>
                            <label for="button1" class="form-label"><?php echo app_lang('button1'); ?></label>
                            <?php echo form_input([
                                'id'          => 'button1',
                                'name'        => 'button1',
                                'value'       => $bot['button1'] ?? '',
                                'class'       => 'form-control alphanumericMaxlength',
                                'placeholder' => app_lang('enter_button1'),
                                'maxlength'   => '20',
                            ]); ?>
                        </div>
                        <div class="form-group col-md-6">
                            <span class="ml2" data-container="body" data-bs-toggle="tooltip" title="<?php echo app_lang('maximum_allowed_characters_256'); ?>" data-bs-placement="left"><i data-feather="help-circle" class="icon-16"></i></span>
                            <label for="button1_id" class="form-label"><?php echo app_lang('button1_id'); ?></label>
                            <?php echo form_input([
                                'id'          => 'button1_id',
                                'name'        => 'button1_id',
                                'value'       => $bot['button1_id'] ?? '',
                                'class'       => 'form-control',
                                'placeholder' => app_lang('enter_button1_id'),
                                'maxlength'   => '256',
                            ]); ?>
                        </div>
                    </div>
                    <div class="row">
                        <div class="form-group col-md-6">
                            <span class="ml2" data-container="body" data-bs-toggle="tooltip" title="<?php echo app_lang('maximum_allowed_characters_20'); ?>" data-bs-placement="left"><i data-feather="help-circle" class="icon-16"></i></span>
                            <label for="button2" class="form-label"><?php echo app_lang('button2'); ?></label>
                            <?php echo form_input([
                                'id'          => 'button2',
                                'name'        => 'button2',
                                'value'       => $bot['button2'] ?? '',
                                'class'       => 'form-control alphanumericMaxlength',
                                'placeholder' => app_lang('enter_button2'),
                                'maxlength'   => '20',
                            ]); ?>
                        </div>
                        <div class="form-group col-md-6">
                            <span class="ml2" data-container="body" data-bs-toggle="tooltip" title="<?php echo app_lang('maximum_allowed_characters_256'); ?>" data-bs-placement="left"><i data-feather="help-circle" class="icon-16"></i></span>
                            <label for="button2_id" class="form-label"><?php echo app_lang('button2_id'); ?></label>
                            <?php echo form_input([
                                'id'          => 'button2_id',
                                'name'        => 'button2_id',
                                'value'       => $bot['button2_id'] ?? '',
                                'class'       => 'form-control',
                                'placeholder' => app_lang('enter_button2_id'),
                                'maxlength'   => '256',
                            ]); ?>
                        </div>
                    </div>
                    <div class="row">
                        <div class="form-group col-md-6">
                            <span class="ml2" data-container="body" data-bs-toggle="tooltip" title="<?php echo app_lang('maximum_allowed_characters_20'); ?>" data-bs-placement="left"><i data-feather="help-circle" class="icon-16"></i></span>
                            <label for="button3" class="form-label"><?php echo app_lang('button3'); ?></label>
                            <?php echo form_input([
                                'id'          => 'button3',
                                'name'        => 'button3',
                                'value'       => $bot['button3'] ?? '',
                                'class'       => 'form-control alphanumericMaxlength',
                                'placeholder' => app_lang('enter_button3'),
                                'maxlength'   => '20',
                            ]); ?>
                        </div>
                        <div class="form-group col-md-6">
                            <span class="ml2" data-container="body" data-bs-toggle="tooltip" title="<?php echo app_lang('maximum_allowed_characters_256'); ?>" data-bs-placement="left"><i data-feather="help-circle" class="icon-16"></i></span>
                            <label for="button2_id" class="form-label"><?php echo app_lang('button3_id'); ?></label>
                            <?php echo form_input([
                                'id'          => 'button3_id',
                                'name'        => 'button3_id',
                                'value'       => $bot['button3_id'] ?? '',
                                'class'       => 'form-control',
                                'placeholder' => app_lang('enter_button3_id'),
                                'maxlength'   => '256',
                            ]); ?>
                        </div>
                    </div>
                    <hr>
                    <h5 class="mb-4 mt-4"><?php echo app_lang('option_bot_with_link'); ?></h5>
                    <div class="row">
                        <div class="form-group col-md-12">
                            <span class="ml2" data-container="body" data-bs-toggle="tooltip" title="<?php echo app_lang('maximum_allowed_characters_20'); ?>" data-bs-placement="left"><i data-feather="help-circle" class="icon-16"></i></span>
                            <label for="button_name" class="form-label"><?php echo app_lang('button_name'); ?></label>
                            <?php echo form_input([
                                'id'          => 'button_name',
                                'name'        => 'button_name',
                                'value'       => $bot['button_name'] ?? '',
                                'class'       => 'form-control',
                                'placeholder' => app_lang('enter_button_name'),
                                'maxlength'   => '20',
                                'pattern'     => '^[A-Za-z0-9\s]{1,20}$',
                            ]); ?>
                        </div>

                        <div class="form-group col-md-12">
                            <label for="button_url" class="form-label"><?php echo app_lang('button_link'); ?></label>
                            <?php echo form_input([
                                'id'          => 'button_url',
                                'name'        => 'button_url',
                                'type'        => 'url',
                                'value'       => $bot['button_url'] ?? '',
                                'class'       => 'form-control',
                                'placeholder' => app_lang('enter_button_url'),
                            ]); ?>
                        </div>
                    </div>
                    <hr>
                    <h5 class="mb-4 mt-4"><?php echo app_lang('option_bot_with_file'); ?></h5>
                    <input type="hidden" name="filename" value="<?php echo $bot['filename'] ?? ''; ?>">
                    <?php $allowd_extension = wbGetAllowedExtension(); ?>
                    <div class="row">
                        <div class="col-md-12 <?= (isset($bot) && !empty($bot['filename'])) ? 'hide' : '' ?>">
                            <label for="file_type" class="form-label"><?php echo app_lang('choose_file_type'); ?></label>
                            <?php
                            echo form_dropdown([
                                'name'  => 'file_type',
                                'id'    => 'file_type',
                                'class' => 'form-control validate-hidden select2',
                            ], ['image' => app_lang('image'), 'document' => app_lang('document')], 'image');
                            ?>
                        </div>
                        <div class="row <?= (isset($bot) && empty($bot['filename'])) ? 'hide' : '' ?>">
                            <?php if (isset($bot)) : ?>
                                <?php $imgExt = array_map('trim', explode(',', $allowd_extension['image']['extension']));
                                $docExt = array_map('trim', explode(',', $allowd_extension['document']['extension'])); ?>
                                <?php if (in_array('.' . wb_get_file_extension($bot['filename']), $imgExt)) { ?>
                                    <div class="col-md-9">
                                        <img src="<?= base_url('files/whatsboost/bot/' . $bot['filename']); ?>" class="img img-responsive" height="70%" width="70%">
                                    </div>
                                <?php } elseif (in_array('.' . wb_get_file_extension($bot['filename']), $docExt)) { ?>
                                    <div class="col-md-9">
                                        <i data-feather="file-plus" class="icon-16"></i>
                                        <a href="<?= base_url('files/whatsboost/bot/' . $bot['filename']) ?>" target="_blank">
                                            <label class="text-primary"><?= $bot['filename']; ?></label>
                                        </a>
                                    </div>
                                <?php } ?>
                                <div class="col-md-3 float-end">
                                    <a href="javascript:void(0)" class="delete" data-url="<?php echo get_uri('whatsboost/bots/delete_bot_file/' . $bot['id']); ?>" id="delete_wb_file"><i data-feather='x' class='icon-16 text-danger'></i></a>
                                </div>
                            <?php endif ?>
                        </div>
                        <div class="form-group col-md-12 <?php echo (isset($bot) && !empty($bot['filename'])) ? 'hide' : ''; ?>">
                            <input type="hidden" id="maxFileSize" value="">
                            <label id="bot_file_label" for="bot_file" class="control-label"></label>
                            <input type="file" name="file" id="bot_file" accept="" class="form-control bot_image" autocomplete="off">
                        </div>
                    </div>
                </div>
                <div class="card-footer text-end">
                    <button type="submit" class="btn btn-primary"><?php echo app_lang('save_bot'); ?></button>
                </div>
            </div>
        </div>
    </div>
    <?php echo form_close(); ?>
</div>
<script>
    "use strict";
    $('#rel_type, #file_type, #reply_type').select2();

    $(function() {
        $('#file_type').trigger('change');
    });

    $(document).on('change', '#rel_type', function(event) {
        if ($(this).val() == "leads") {
            $('.help_reply_text').attr('title', `<?php echo sprintf(app_lang('reply_text_note'), app_lang('leads')); ?>`).tooltip('dispose').tooltip();
        } else {
            $('.help_reply_text').attr('title', `<?php echo sprintf(app_lang('reply_text_note'), app_lang('contacts')); ?>`).tooltip('dispose').tooltip();
        }
    });

    // custom validation for alphanumericMaxlength
    $.validator.addMethod("alphanumericMaxlength", function(value, element) {
        // Check if value is alphanumeric with spaces and does not exceed 20 characters
        return this.optional(element) || /^[A-Za-z0-9\s]{1,20}$/.test(value);
    }, "<?php echo app_lang('alphanumericMaxlength_note'); ?>");

    window.messageBotForm = $("#message_bot_form").appForm({
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
                window.location = "<?php echo site_url('whatsboost/bots/message_bot'); ?>";
            }, 1000);
        }
    });

    $(document).on('change', '#file_type', function() {
        var value = $(this).val();
        const imageMaxSize = "<?= $allowd_extension['image']['size'] ?>";
        const documentMaxSize = "<?= $allowd_extension['document']['size'] ?>";
        const imageAllowedExt = "<?= $allowd_extension['image']['extension'] ?>";
        const documentAllowedExt = "<?= $allowd_extension['document']['extension'] ?>";
        if (value == 'image') {
            $('#maxFileSize').val(imageMaxSize);
            $('#bot_file_label').html("<?= app_lang('image') ?>" + '<small class="text-muted">' + "( <?= app_lang('max_size') . $allowd_extension['image']['size'] . ' MB), ( ' .  app_lang('allowed_file_types') . $allowd_extension['image']['extension'] ?> )" + '</small>');
            $('#bot_file').attr('accept', imageAllowedExt);
            $('.file_tootltip').data('title', '<?= app_lang('maximum_file_size_should_be') ?>' + imageMaxSize + ' MB');
        } else if (value == 'document') {
            $('#maxFileSize').val(documentMaxSize);
            $('#bot_file_label').html("<?= app_lang('document') ?>" + '<small class="text-muted">' + "( <?= app_lang('max_size') . $allowd_extension['document']['size'] . ' MB), ( ' .  app_lang('allowed_file_types') . $allowd_extension['document']['extension'] ?> )" + '</small>');
            $('#bot_file').attr('accept', documentAllowedExt);
            $('.file_tootltip').data('title', '<?= app_lang('maximum_file_size_should_be') ?>' + documentMaxSize + ' MB');
        }
    });
</script>
