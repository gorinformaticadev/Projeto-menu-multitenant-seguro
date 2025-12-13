<?php if (!empty($template)) { ?>
    <?php if (!empty($template->header_data_format) && $template->header_params_count > 0) { ?>
        <h4 class="tw-mt-0 tw-font-semibold tw-text-neutral-700"><?php echo app_lang('header'); ?></h4>
        <?php if ('TEXT' === $template->header_data_format) { ?>
            <?php for ($i = 1; $i <= $template->header_params_count; ++$i) { ?>
                <div class="form-group">
                    <label for="<?php echo app_lang('variable') . ' ' . $i; ?>" class="form-label"><?php echo app_lang('variable') . ' ' . $i; ?></label>
                    <?php echo form_input([
                        'id'           => "header_params[$i][value]",
                        'name'         => "header_params[$i][value]",
                        'value'        => $header_params->$i->value ?? '',
                        'class'        => "form-control header_param_text header_input header[$i] mentionable",
                        'autocomplete' => 'off',
                    ]); ?>
                </div>
            <?php } ?>
        <?php } else { ?>
            <div class="alert alert-danger"><?php echo app_lang('currently_type_not_supported', $template['header_data_format']); ?></div>
        <?php } ?>
        <hr>
    <?php } ?>
    <?php $allowd_extension = wbGetAllowedExtension(); ?>
    <?php if (!empty($template->header_data_format) && 'IMAGE' === $template->header_data_format) { ?>
        <h4 class="tw-mt-0 tw-font-semibold tw-text-neutral-700"><?php echo app_lang('image'); ?></h4>
        <input type="hidden" id="maxFileSize" value="<?php echo $allowd_extension['image']['size']; ?>">
        <input type="hidden" name="filename" value="<?php echo isset($campaign) ? $campaign['filename'] : ''; ?>">
        <div class="view_campaign_image <?php echo (isset($campaign) && empty($campaign['filename'])) ? 'hide' : ''; ?>">
            <?php if (isset($campaign)) { ?>
                <div class="row">
                    <div class="col-md-9">
                        <input type="hidden" id="image_url" value="<?php echo (!empty($campaign['filename'])) ? base_url('files/whatsboost/' . ('1' == $campaign['is_bot'] ? 'template' : 'campaign') . '/' . $campaign['filename']) : ''; ?>">
                        <img src="<?php echo base_url('files/whatsboost/' . ('1' == $campaign['is_bot'] ? 'template' : 'campaign') . '/' . $campaign['filename']); ?>" class="img img-responsive" height="70%" width="70%">
                    </div>
                    <div class="col-md-3 text-right">
                        <a href="javascript:void(0)" class="delete" data-url="<?php echo get_uri('whatsboost/campaigns/delete_campaign_file/' . $campaign['id']); ?>" id="delete_wb_file"><i data-feather='x' class='icon-16 text-danger'></i></a>
                    </div>
                </div>
            <?php } ?>
        </div>
        <div class="campaign_image <?php echo (isset($campaign) && !empty($campaign['filename'])) ? 'hide' : ''; ?>">
            <label for="file" class="control-label">
                <span class="ml2" data-container="body" data-bs-toggle="tooltip" title="<?php echo app_lang('maximum_file_size_should_be') . $allowd_extension['image']['size'] . ' MB'; ?>" data-bs-placement="top"><i data-feather="help-circle" class="icon-16"></i></span>
                <?php echo app_lang('select_image'); ?>
                <small class="text-muted">( <?php echo app_lang('allowed_file_types') . $allowd_extension['image']['extension']; ?> )</small>
            </label>
            <input type="file" name="file" id="file" accept="<?php echo $allowd_extension['image']['extension']; ?>" class="form-control header_image" autocomplete="off">
        </div>
        <hr>
    <?php } ?>
    <?php if (!empty($template->header_data_format) && 'DOCUMENT' === $template->header_data_format): ?>
        <h4 class="tw-mt-0 tw-font-semibold tw-text-neutral-700"><?php echo app_lang('document'); ?></h4>
        <input type="hidden" id="maxDocumentSize" value="<?= $allowd_extension['document']['size'] ?>">
        <input type="hidden" name="filename" value="<?php echo isset($campaign) ? $campaign['filename'] : ''; ?>">
        <div class="view_campaign_document <?= (isset($campaign) && empty($campaign['filename'])) ? 'hide' : '' ?>">
            <?php if (isset($campaign)) : ?>
                <div class="row mtop15">
                    <div class="col-md-10">
                        <i data-feather="file-plus" class="icon-16"></i>
                        <a href="<?= base_url('files/whatsboost/' . ($campaign['is_bot'] == '1' ? 'template' : 'campaign') . '/' . $campaign['filename']) ?>" target="_blank">
                            <label class="text-primary"><?= $campaign['filename']; ?></label>
                        </a>
                    </div>
                    <div class="col-md-2 float-end">
                        <a href="javascript:void(0)" class="delete" data-url="<?php echo get_uri('whatsboost/campaigns/delete_campaign_file/' . $campaign['id']); ?>" id="delete_wb_file"><i data-feather='x' class='icon-16 text-danger'></i></a>
                    </div>
                </div>
            <?php endif ?>
        </div>
        <div class="campaign_document <?= (isset($campaign) && !empty($campaign['filename'])) ? 'hide' : '' ?>">
            <label for="document" class="control-label">
                <span class="ml2" data-container="body" data-bs-toggle="tooltip" title="<?= app_lang('maximum_file_size_should_be') . $allowd_extension['document']['size'] . ' MB' ?>" data-bs-placement="top"><i data-feather="help-circle" class="icon-16"></i></span>
                <?= app_lang('select_document') ?>
                <small class="text-muted">( <?= app_lang('allowed_file_types') . $allowd_extension['document']['extension'] ?> )</small>
            </label>
            <input type="file" name="document" id="document" accept="<?= $allowd_extension['document']['extension'] ?>" class="form-control header_document">
        </div>
        <hr>
    <?php endif ?>
    <?php if (!empty($template->body_params_count) && $template->body_params_count > 0) { ?>
        <h4 class="tw-mt-0 tw-font-semibold tw-text-neutral-700"><?php echo app_lang('body'); ?></h4>
        <?php for ($i = 1; $i <= $template->body_params_count; ++$i) { ?>
            <div class="form-group">
                <label for="<?php echo app_lang('variable') . ' ' . $i; ?>" class="form-label"><?php echo app_lang('variable') . ' ' . $i; ?></label>
                <?php echo form_input([
                    'id'           => "body_params[$i][value]",
                    'name'         => "body_params[$i][value]",
                    'value'        => $body_params->$i->value ?? '',
                    'class'        => "form-control body_param_text body_input body[$i] mentionable",
                    'autocomplete' => 'off',
                ]); ?>
            </div>
        <?php } ?>
        <hr>
    <?php } ?>
    <?php if (!empty($template->footer_params_count) && $template->footer_params_count > 0) { ?>
        <h4 class="tw-mt-0 tw-font-semibold tw-text-neutral-700"><?php echo app_lang('footer'); ?></h4>
        <?php for ($i = 1; $i <= $template->footer_params_count; ++$i) { ?>
            <div class="form-group">
                <label for="<?php echo app_lang('variable') . ' ' . $i; ?>" class="form-label"><?php echo app_lang('variable') . ' ' . $i; ?></label>
                <?php echo form_input([
                    'id'           => "footer_params[$i][value]",
                    'name'         => "footer_params[$i][value]",
                    'value'        => $footer_params->$i->value ?? '',
                    'class'        => "form-control footer_param_text footer_input footer[$i] mentionable",
                    'autocomplete' => 'off',
                ]); ?>
            </div>
        <?php } ?>
        <hr>
    <?php } ?>
<?php } ?>
