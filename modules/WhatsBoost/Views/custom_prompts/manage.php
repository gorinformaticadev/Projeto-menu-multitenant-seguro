<div id="page-content" class="page-wrapper clearfix">
    <div class="card">
        <div class="page-title clearfix rounded">
            <div class="d-flex justify-content-between align-items-center">
                <h1><?php echo app_lang('custom_ai_prompts'); ?></h1>
                <?php if (check_wb_permission($user, 'wb_create_ai_prompts')) { ?>
                    <div class="title-button-group">
                        <?php echo modal_anchor(get_uri("whatsboost/custom_prompt"), "<i data-feather='plus-circle' class='icon-16'></i> " . app_lang('custom_prompt'), array("class" => "btn btn-primary", "title" => app_lang('custom_ai_prompt'))); ?>
                    </div>
                <?php } ?>
            </div>
        </div>
        <div class="table-responsive">
            <table id="custom_prompts_table" class="display" cellspacing="0" width="100%">
            </table>
        </div>
    </div>
</div>

<script type="text/javascript">
    "use strict";

    $(function() {
        $("#custom_prompts_table").appTable({
            source: '<?php echo_uri("whatsboost/custom_prompts/table"); ?>',
            columns: [{
                    title: '#'
                },
                {
                    title: '<?php echo app_lang('name'); ?>'
                },
                {
                    title: '<?php echo app_lang('prompt_action'); ?>'
                },
                {
                    title: '<?php echo app_lang('action'); ?>',
                    class: "text-center option w175"
                },
            ],
            order: [
                [0, "desc"]
            ],
            printColumns: [0, 1, 2, 3],
            xlsColumns: [0, 1, 2, 3]
        });
    });
</script>
