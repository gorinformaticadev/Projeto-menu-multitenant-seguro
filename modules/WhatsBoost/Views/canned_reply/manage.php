<div id="page-content" class="page-wrapper clearfix">
    <div class="card">
        <div class="page-title clearfix rounded">
            <div class="d-flex justify-content-between align-items-center">
                <h1><?php echo app_lang('canned_reply'); ?></h1>
                <?php if (check_wb_permission($user, 'wb_create_canned_reply')) { ?>
                    <div class="title-button-group">
                        <?php echo modal_anchor(get_uri("whatsboost/canned_reply"), "<i data-feather='plus-circle' class='icon-16'></i> " . app_lang('create_canned_reply'), array("class" => "btn btn-primary", "title" => app_lang('create_canned_reply'))); ?>
                    </div>
                <?php } ?>
            </div>
        </div>
        <div class="table-responsive">
            <table id="canned_replies_table" class="display" cellspacing="0" width="100%">
            </table>
        </div>
    </div>
</div>

<script type="text/javascript">
    "use strict";

    $(function() {
        $("#canned_replies_table").appTable({
            source: '<?php echo_uri("whatsboost/canned_replies/table"); ?>',
            columns: [{
                    title: '#'
                },
                {
                    title: '<?php echo app_lang('title'); ?>'
                },
                {
                    title: '<?php echo app_lang('description'); ?>'
                },
                {
                    title: '<?php echo app_lang('public'); ?>'
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

        $(document).on('change', '#canned_status', function(event) {
            let is_public = $(this).prop("checked") === true ? 1 : 0;
            
            $.ajax({
                url: '<?php echo_uri('whatsboost/canned_reply/status'); ?>',
                type: 'post',
                data: {
                    id: $(this).data('id'),
                    is_public: is_public,
                },
                dataType: 'json'
            }).done(function(res) {
                appAlert.success(res.message, {
                    duration: 2000
                });
            });
        });
        $(document).on('change', '#canned_status', function(event) {
            let is_public = $(this).prop("checked") === true ? 1 : 0;
            
            $.ajax({
                url: '<?php echo_uri('whatsboost/chat_required_data'); ?>',
                type: 'post',
                dataType: 'json'
            }).done(function(res) {
                console.log(res);
            });
        });
    });
</script>